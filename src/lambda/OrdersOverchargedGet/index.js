'use strict';

let AWS = require('aws-sdk');

if (process.env.NODE_ENV !== 'test') {
  const AWSXRay = require('aws-xray-sdk');
  AWS = AWSXRay.captureAWS(AWS);
}

const BATCH_SIZE = 100;

exports.handler = async (event, context, callback) => {
  try{
  if (!event.date) {
    throw new Error('date not specified');
  }
  const date = event.date;
  let docClient = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});
  const params = {
    TableName: "Orders",
    IndexName: "OrderCreateDateTime-index",
    KeyConditionExpression: "OrderCreateDate = :date",
    ExpressionAttributeValues: {
      ":date": date,
    },
  };

  const overcharged = {};
  let data;
  do {
    data = await docClient.query(params).promise();
    for (let order of data.Items) {
      const amount = getOrderOvercharge(order);
      if (amount > 0) {
        overcharged[order.OrderNumber] = amount;
      }
    }
    params.ExclusiveStartKey = data.LastEvaluatedKey;
  } while (data.LastEvaluatedKey);
    callback(null, buildResponse(200, overcharged));
  } catch (error) {
    console.log(error.message);
    callback(null, buildResponse(500, { error: error.message }));
    throw error;
  }

  function buildResponse(code, result) {
      return {
          statusCode: code,
          body: JSON.stringify(result),
      }
  }

  function getOrderOvercharge(order) {
    let total = 0;
    for (let item of order.Items) {
      total += parseInt(item.RowTotalActual);
    }
    total += parseInt(order.OrderTotalDetails.Shipping);
    const paid = parseInt(order.OrderTotalDetails.Paid);
    return (paid > total) ? paid - total : 0;
  }
};
