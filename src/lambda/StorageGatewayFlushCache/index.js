'use strict';

let AWS = require('aws-sdk');
if (process.env.NODE_ENV !== "test") {
  const AWSXRay = require("aws-xray-sdk");
  AWS = AWSXRay.captureAWS(AWS);
}

exports.handler = async (event) => {
  try {
    const storagegateway = new AWS.StorageGateway();
    const FileShareId = event.FileShareId;
    const sts = new AWS.STS();

    if (!FileShareId) {
      throw new Error("Missing FileShareARN");
    }

    const params = {
      FileShareARN: 'arn:aws:storagegateway:eu-west-1:339088465693:share/' + FileShareId,
    };

    const sts_params = {
      RoleArn: process.env.STS_STORAGEGATEWAY_ROLE,
      RoleSessionName: "Session1",
      ExternalId: process.env.STS_STORAGEGATEWAY_ID,
    };

    const sts_result = await sts.assumeRole(sts_params).promise();

    console.log("sts result", JSON.stringify(sts_result));

    AWS.config.credentials = new AWS.TemporaryCredentials({RoleArn: sts_params.RoleArn});

    console.log(AWS.config.credentials);

    await storagegateway.refreshCache(params).promise();
    console.log(`Cache refreshed on ${FileShareId}`);

  } catch (err) {
    console.log(event, err, err.stack);
    throw err;
  }

};