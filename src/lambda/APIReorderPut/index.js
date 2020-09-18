"use strict";

let docClient;
let lambda;
let AWS = process.env.NODE_ENV === "test"
    ? require("aws-sdk")
    : require("aws-xray-sdk").captureAWS(require("aws-sdk"));
const { OMS } = require("plt-layer");

exports.handler = async (event, context, callback) => {
    try {
        setupAWS();
        const reorderRequest = getReorderRequest(event);
        const parentOrder = await getParentOrder(reorderRequest);
        const createReorderResponse = await createReorderEntry(reorderRequest);
        await updateParentOrder(reorderRequest, parentOrder, createReorderResponse.OrderNumber);
        return getResponse(200, { 'OrderNumber': createReorderResponse.OrderNumber });
    } catch (error) {
        return getResponse(500, error.toString());
    }
};

function getReorderRequest(event) {
    if (event.body !== null && event.body !== undefined) {
        return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }

    throw new Error('Invalid payload');
}

async function createReorderEntry(order) {
    const params = {
        FunctionName: process.env.LAMBDA_ORDER_PUT,
        Payload: JSON.stringify({body: order})
    };
    const response = await lambda.invoke(params).promise();

    if (response.StatusCode !== 200) {
        throw new Error(JSON.stringify(response));
    }

    let parsedResponse = JSON.parse(response.Payload);

    return JSON.parse(parsedResponse.body);
}

async function getParentOrder(reorderRequest) {
    const parentOrder = await OMS.Order.getById(reorderRequest.ParentOrderId);

    if (!parentOrder) {
        throw new Error(`Parent Order not found. Parent Order Number: ${reorderRequest.ParentOrderId}`)
    }

    return parentOrder;
}

async function updateParentOrder(reorderRequest, parentOrder, reorderedOrderNumber) {
    const updateOrderLineStatuses = [];

    for (const reorderedItem of reorderRequest.Items) {
        let parentOrderItemIndex = parentOrder.Items.findIndex(orderItem => orderItem.Sku.trim() === reorderedItem.Sku.trim());
        if (parentOrderItemIndex >= 0) {
            updateOrderLineStatuses.push({
                index: parentOrderItemIndex,
                value: {
                    Status: "Reordered",
                    Qty: reorderedItem.Quantity,
                    OrderNumber: reorderedOrderNumber
                }
            })
        }
    }

    if (updateOrderLineStatuses.length > 0) {
        await OMS.Order.updateOrderlineStatus(reorderRequest.ParentOrderId,updateOrderLineStatuses);
        await OMS.Order.updateOrder(reorderRequest.ParentOrderId, {
            Reordered: "true"
        })
    }
}

function getResponse(status, body) {
    console.log(body);
    return {
        statusCode: status,
        body: JSON.stringify(body)
    }
}

function setupAWS() {
    lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
    docClient = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});
}
