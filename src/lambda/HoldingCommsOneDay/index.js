'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const moment = require('moment');
const { OMS } = require("plt-layer");

const EVENT_ID = 7611;
const NEXT_DAY_DELIVERY_CODE = 'flatrate2_flatrate2';

exports.handler = async () => {
  let data;
  const sqs = new AWS.SQS();
  const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

  try {
    await processOrders(docClient, getNotShippedQuery(getDate()));
    await processOrders(docClient, getNotShippedQuery(`${NEXT_DAY_DELIVERY_CODE}-${getDate()}`));
  } catch (e) {
    console.log(e);
    throw e;
  }

  return true;

  async function publishEmailToSQS(message) {
    const params = {
      MessageBody: JSON.stringify(message),
      QueueUrl: process.env.SQS_QUEUE_URL,
    };

    return sqs.sendMessage(params).promise();
  }

  async function processOrders(docClient, params) {
    do {
      data = await docClient.query(params).promise();

      for (const order of data.Items) {
        const orderData = await OMS.Order.getById(order.OrderId);
        await publishEmailToSQS(buildEmailMessage(orderData));
      }
      params.ExclusiveStartKey = data.LastEvaluatedKey;
    } while (data.LastEvaluatedKey)
  }

  function getNotShippedQuery(notShipped) {
    return {
      IndexName: 'NotShipped-index',
      KeyConditionExpression: 'NotShipped = :notShipped',
      ExpressionAttributeValues: {
        ':notShipped': notShipped,
      },
      TableName: 'OrdersV3',
      ScanIndexForward: false
    };
  }

  function buildEmailMessage(order) {
    return {
      key_id: '3',
      event_id: EVENT_ID,
      external_id: order.CustomerDetails.Email,
      data: {
        orderNo: order.OrderNumber,
        customerDetails: {
          firstName: order.CustomerDetails.FirstName,
          lastName: order.CustomerDetails.LastName,
        },
        estimatedDeliveryDate: order.EstimatedDeliveryDate
          ? formatDate(order.EstimatedDeliveryDate) : null,
      }
    };
  }

  function formatDate(dateString) {
    return moment(dateString).format('dddd Do MMMM');
  }

  function getDate() {
    return moment().subtract(2, 'day').format('YYYY-MM-DD');
  }
};
