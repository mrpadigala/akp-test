"use strict";

let AWS = require("aws-sdk");
const { OMS } = require('plt-layer');

if (process.env.NODE_ENV !== "test") {
    const AWSXRay = require("aws-xray-sdk");
    AWS = AWSXRay.captureAWS(AWS);
}

const https = require('https');

const sslAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    rejectUnauthorized: true
});

AWS.config.update({
    httpOptions: {
        agent: sslAgent
    }
});

sslAgent.setMaxListeners(0);

const uuidv4 = require('uuid/v4');
let docClient;
let sns;
let ORDER_PROCESSOR_STATE_MACHINE_ARN;
let stepFunction;

exports.handler = async (event, context, callback) => {
    console.log(event);
    ORDER_PROCESSOR_STATE_MACHINE_ARN = process.env.ORDER_PROCESSOR_STATE_MACHINE_ARN;
    docClient = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});
    sns = new AWS.SNS();
    stepFunction = new AWS.StepFunctions();

    let body = '';
    if (event.body !== null && event.body !== undefined) {
        body = event.body;
        if (typeof body === 'string') {
            body = JSON.parse(event.body);
        }
    }

    switch(body.action) {
        case 'uphold':
            return await upholdOrder(body, callback);

        case 'cancel':
            return await cancelOrder(body, callback);

        default:
            return callback(null, buildResponse(500, { error: 'event action is missing' }));
    }

};

async function upholdOrder(event, callback) {
    try {
        let pendingOrder = await getPendingOrderByOrderId(event.orderid);
        pendingOrder.FraudCheckApproved = 'true';
        await OMS.Order.updateOrder(pendingOrder.OrderId, {
            FraudCheckApproved: 'true',
        });
        await updateFraudCheckApproved(event.orderid, pendingOrder.FraudCheckApproved);
        await invokeOrderProcessorStepFunction(event.orderid);
        await deletePendingOrder(event.orderid);
        await addOrderLogMessage(event, "Order upheld after fraud checks", "Order Upheld");

        return callback(null, buildResponse(200, { message: 'Order upheld after fraud checks' }));
    } catch (error) {
        console.log(error);
        return callback(null, buildResponse(500, { error: error.toString() }));
    }
}

async function cancelOrder(event, callback) {
    try {
        let pendingOrder = await getPendingOrderByOrderId(event.orderid);
        await updatePendingOrderStatusToCancelled(pendingOrder);
        await updateFraudCheckApproved(event.orderid, 'cancelled');
        await invokeOrderProcessorStepFunction(event.orderid);
        await deletePendingOrder(event.orderid);
        await addOrderRefund(pendingOrder);
        await addOrderLogMessage(event, "Order cancelled after fraud checks", "Order Cancelled");
        await updateInventoryService(pendingOrder.OrderNumber, pendingOrder.Items, 'increment');

        return callback(null, buildResponse(200, { message: 'Order cancelled after fraud checks' }));
    } catch (error) {
        console.log(error);
        return callback(null, buildResponse(500, { error: error.toString() }));
    }
}

async function getPendingOrderByOrderId(orderId) {
    let pendingOrder = await docClient
        .get({
            TableName: "OrdersPending",
            Key: {
                OrderId: orderId
            }
        }).promise();

    if (!pendingOrder.Item || pendingOrder.Item.length < 1) {
        throw new Error('Pending Order not found');
    }

    return pendingOrder.Item;
}

async function updateFraudCheckApproved(orderId, status) {
    let params = {
        FraudCheckApproved: status
    };

    return OMS.Order.updateOrder(orderId, params);
}

async function deletePendingOrder(orderId) {
    return docClient.delete({
        TableName: "OrdersPending",
        Key: {
            OrderId: orderId
        }
    }).promise();
}

async function addOrderLogMessage(event, comment, type) {
    let logItem = {
        TableName: "OrdersLogs",
        Item: {
            Comment: comment,
            CreatedAt: new Date().toISOString(),
            Id: uuidv4(),
            OrderId: event.orderid,
            Type: type,
            User: event.user || '',
            UserId: event.userid || ''
        }
    };

    return docClient.put(logItem).promise();
}

function updatePendingOrderStatusToCancelled(order) {
    const newStatus = 'Cancelled - Fraud Check';
    order.OrderStatus = newStatus;
    return  OMS.Order.updateOrder(order.OrderId, {
        OrderStatus: newStatus,
    });
}

async function addOrderRefund(order) {
    let oid = `OID-${order.OrderNumber}-${Math.floor(Math.random() * 99)}`;

    let refundItem = {
        TableName: "Refunds",
        Item: {
            Id: uuidv4(),
            RefundId: oid,
            OrderNumber: order.OrderNumber,
            PaymentMethod: order.PaymentDetails.Method,
            RefundType: '1',
            RefundShipping: 'Yes',
            Source: 'OMS_Interface',
            OrderLines: getOrderlinesFromOrderCancelled(order, oid),
            IsException: 'false',
            IsProcessed: 'Pending',
            CreatedAt: new Date().getTime(),
            RefundedAt: 0
        }
    };

    return docClient.put(refundItem).promise();
}

function buildResponse(code, result) {
    return {
        statusCode: code,
        headers: {
            plt_api: "internal"
        },
        body: JSON.stringify(result),
        isBase64Encoded: false
    }
}

function getOrderlinesFromOrderCancelled(order, oid){
    return order.Items.map( item => {
        return {
            "Data": oid,
            "KeyTable": null,
            "LineTotal": calculateLineTotal(item).toFixed(5),
            "ProductSku": item.Sku,
            "Quantity": parseFloat(item.Quantity).toFixed(5)
        }
    });
}

function calculateLineTotal(item) {
    let total = item.RowTotalActualInclTax ?
      item.RowTotalActualInclTax :
      (typeof item.RowTotalActual === 'undefined') ? (item.RowTotalInclTax - item.Discount) : item.RowTotalActual;

    return parseFloat(total);
}

async function updateInventoryService(orderNumber, items, updateType) {
    await items.filter( (item) => {
        const acceptable = ['configurable', 'simple'];
        return acceptable.indexOf(item.ProductType) != -1;
    }).map(async item => {
        const message = buildInventoryMessage(orderNumber, item, updateType);
        await sendInventoryMessage(message);
        console.log("Stock updated",message);
    });
}

function buildInventoryMessage(orderNumber, item, updateType) {
    return {
        "OperationType": "Order",
        "From": `${orderNumber}`,
        "ProductId": item.Sku,
        "ProductQty": updateType === 'increment' ? parseInt(item.Quantity) : -parseInt(item.Quantity)
    };
}

function sendInventoryMessage(message) {
    let params = {
        Message: JSON.stringify(message),
        TopicArn: process.env.WMS_INVENTORY_SNS_TOPIC
    };

    return sns.publish(params).promise();
}

async function invokeOrderProcessorStepFunction(orderId) {
    const params = {
        stateMachineArn: ORDER_PROCESSOR_STATE_MACHINE_ARN,
        input: JSON.stringify({ OrderId: orderId}),
        name: `OrderNumber-${orderId}`
    };

    try {
        await stepFunction.startExecution(params).promise();
    } catch (e) {
        console.log(`Step function error ${orderId}`);
        console.log(e);
    }
}
