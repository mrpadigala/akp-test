"use strict";

let AWS = require("aws-sdk");

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

exports.handler = async (event) => {

  docClient = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});

  let body = '';
  if (event.body !== null && event.body !== undefined) {
    body = event.body;
    if (typeof body === 'string') {
      body = JSON.parse(event.body);
    }
  }

  for (const ordernumber of body.orders) {
    if (body.action === 'uphold') {
      await upholdOrder(ordernumber);
      console.log(`Uphold ${ordernumber}`);
    }
    if (body.action === 'cancel') {
      await cancelOrder(ordernumber);
      console.log(`Cancel ${ordernumber}`);
    }
  }
};

async function upholdOrder(orderid) {
  try {
    let pendingOrder = await getPendingOrderByOrderId(orderid);
    pendingOrder.FraudCheckApproved = 'true';
    await savePendingOrderToOrdersTable(pendingOrder);
    await deletePendingOrder(orderid);
    await addOrderLogMessage(orderid, "Order upheld after fraud checks", "Order Upheld");

    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function cancelOrder(orderid) {
  try {
    let pendingOrder = await getPendingOrderByOrderId(orderid);
    updatePendingOrderStatusToCancelled(pendingOrder);
    await savePendingOrderToOrdersTable(pendingOrder);
    await deletePendingOrder(orderid);
    await addOrderRefund(pendingOrder);
    await addOrderLogMessage(orderid, "Order cancelled after fraud checks", "Order Cancelled");

    return true;
  } catch (error) {
    console.log(error);
    throw error;
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

async function savePendingOrderToOrdersTable(order) {
  let orderItem = {
    TableName: "Orders",
    Item: order
  };

  return docClient.put(orderItem).promise();
}

async function deletePendingOrder(orderId) {
  return docClient.delete({
    TableName: "OrdersPending",
    Key: {
      OrderId: orderId
    }
  }).promise();
}

async function addOrderLogMessage(orderid, comment, type) {
  let logItem = {
    TableName: "OrdersLogs",
    Item: {
      Comment: comment,
      CreatedAt: new Date().toISOString(),
      Id: uuidv4(),
      OrderId: orderid,
      Type: type,
      User: 'OMS-Script',
      UserId: '1'
    }
  };

  return docClient.put(logItem).promise();
}

function updatePendingOrderStatusToCancelled(order) {
  order.OrderStatus = 'Cancelled - Fraud Check';
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
  let total = (typeof item.RowTotalActual === 'undefined') ? (item.RowTotalInclTax - item.Discount) : item.RowTotalActual;

  return parseFloat(total);
}