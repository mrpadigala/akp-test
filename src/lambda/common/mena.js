const moment = require('moment');
const AWSXRay = require('aws-xray-sdk');
let AWS = require('aws-sdk');
AWS = AWSXRay.captureAWS(AWS);

function heldMenaOrder(orderId, reasonTypes) {
  const documentClient = new AWS.DynamoDB.DocumentClient();

  const params = {
    TableName: 'OrdersV3',
    Item: {
      OrderId: orderId,
      AttributeId: 'MENA#Held',
      CreatedTimestamp: moment().unix(),
      Reason: 'MENA Order on Held',
      ReasonTypes: reasonTypes,
    },
  };

  return documentClient.put(params).promise();
}

module.exports = { heldMenaOrder };
