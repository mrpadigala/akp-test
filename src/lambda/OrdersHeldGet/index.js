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

exports.handler = async (event, context, callback) => {

  let docClient = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});
  let params = {
    TableName: "OrdersPending"
  };
  let returnData = {
      Orders: [],
      Count: 0
  };
  let data;

  try {
    //while(true) {
      data = await docClient.scan(params).promise();
      data.Items.forEach((item) => {
          returnData.Orders.push(item);
          returnData.Count++;
      });

    //   if (typeof data.LastEvaluatedKey != "undefined") {
    //       params.ExclusiveStartKey = data.LastEvaluatedKey;
    //   } else {
    //     break;
    //   }
    // }

    callback(null, buildResponse(200, returnData));
  } catch (error) {
    console.log(error.message);
    callback(null, buildResponse(500, { error: error.message }));
    throw error;
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
};
