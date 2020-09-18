'use strict';

const moment = require('moment');
const { OMS } = require('plt-layer');

async function sendEmails(sqs, docClient, method, eventId, days) {
  let data;

  const params = getNotShippedQuery(method, days);

  do {
    data = await docClient.query(params).promise();

    for (const order of data.Items) {
      await processOrder(sqs, order.OrderId, eventId);
    }
    params.ExclusiveStartKey = data.LastEvaluatedKey;
  } while (data.LastEvaluatedKey);
}

async function publishEmailToSQS(sqs, message) {
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: process.env.SQS_QUEUE_URL,
  };

  return sqs.sendMessage(params).promise();
}

function getNotShippedQuery(method, days) {
  return {
    IndexName: 'NotShipped-index',
    KeyConditionExpression: 'NotShipped = :orderDate',
    ExpressionAttributeValues: {
      ':orderDate': `${method}-${getDate(days)}`,
    },
    TableName: 'OrdersV3',
    ScanIndexForward: false,
  };
}

async function processOrder(sqs, orderNumber, eventId) {
  const order = await OMS.Order.getById(orderNumber);

  if (hasOnlyVirtualProduct(order) || isOrderRefunded(order)) {
    return Promise.resolve(false);
  }

  console.log(`Process order: ${orderNumber}`);
  return publishEmailToSQS(
    sqs,
    buildEmailMessage(order, eventId),
  );
}

function buildEmailMessage(order, eventId) {
  return {
    key_id: '3',
    event_id: eventId,
    external_id: order.CustomerDetails.Email,
    data: {
      orderNo: order.OrderNumber,
      customerDetails: {
        firstName: order.CustomerDetails.FirstName,
        lastName: order.CustomerDetails.LastName,
      },
      estimatedDeliveryDate: order.EstimatedDeliveryDate
        ? formatDate(order.EstimatedDeliveryDate) : null,
    },
  };
}

function formatDate(dateString) {
  return moment(dateString).format('dddd Do MMMM');
}

function getDate(days) {
  return moment().subtract(days, 'day').format('YYYY-MM-DD');
}

function hasOnlyVirtualProduct(order) {
  const virtualProduct = order.Items.filter(item => {
    return item.Sku.includes('-SUBSCRIPTION') && item.Sku.includes('YEAR');
  });

  return virtualProduct.length === order.Items.length;
}

function isOrderRefunded(order) {
  const refundedItems = [];
  order.Items.forEach(item => {
    refundedItems.push(item.Status ? isItemRefunded(item.Status, parseInt(item.Quantity, 10)) : false);
  });

  return !refundedItems.includes(false);
}

function isItemRefunded(orderItemStatuses, quantity) {
  let refunded = 0;
  let refundRequested = 0;
  let refundPending = 0;

  orderItemStatuses.forEach(status => {
    // eslint-disable-next-line default-case
    switch (status.Status) {
      case 'Refunded':
        refunded += parseInt(status.Qty, 10);
        break;
      case 'Refund Requested':
        refundRequested += parseInt(status.Qty, 10);
        break;
      case 'Refund Pending':
        refundPending += parseInt(status.Qty, 10);
        break;
    }
  });

  return quantity === Math.max(refunded, refundRequested, refundPending);
}

module.exports = {
  sendEmails,
  getNotShippedQuery,
  processOrder,
  buildEmailMessage,
  publishEmailToSQS,
};
