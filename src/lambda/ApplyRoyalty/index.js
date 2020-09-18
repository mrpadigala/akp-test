"use strict";

let AWS = require("aws-sdk");
if (process.env.NODE_ENV !== "test") {
    const AWSXRay = require("aws-xray-sdk");
    AWS = AWSXRay.captureAWS(AWS);
}
const axios = require("axios");
let sns;

exports.handler = async event => {
    const API_ENDPOINT = process.env.API_ENDPOINT;
    sns = new AWS.SNS();

    if (!event.CustomerId) {
        throw new Error ("Customer Id is missing");
    }

    if (!event.StoreId) {
        throw new Error ("Store Id is missing");
    }

    const OPERATION_ADD = "add";
    const OPERATION_REMOVE = "rm";
    const customerId = event.CustomerId;
    const storeId = event.StoreId;

    let operation = event.Operation && (event.Operation === OPERATION_REMOVE) ? OPERATION_REMOVE: OPERATION_ADD;

    try {
        if (process.env.INVOKE_MAGENTO_ROYALTY_SNS !== 'true') {
            await sendToMagento(
              API_ENDPOINT,
              {
                  "customer": customerId,
                  "operation": operation,
                  "store": storeId
              }
            );
        } else {
            await sendToMagentoQueue({
                "CustomerId": customerId,
                "Operation": operation,
                "StoreId": storeId,
                "OrderNumber": event.OrderNumber ? event.OrderNumber : "",
                "StartDate": event.StartDate ? event.StartDate : "",
                "CustomerUuid": event.CustomerUuid ? event.CustomerUuid : ""
            });
        }
    } catch (e) {
        throw e;
    }

    return true;
};

function sendToMagento(url, request) {

    let config = null;
    if (process.env.API_KEY) {
        config = { 'headers': {'x-api-key': process.env.API_KEY}};
    }

    console.log(url,request,config);

    return axios.post(url, request, config)
        .then(response => {
            return response.data;
        })
        .catch(err => {
            if (err.response && err.response.data) {
                console.error("HTTP Status Code: ", err.response.status);
                console.error("HTTP Error: ", err.response.data);
            }
            throw new Error(`Error: ${err.message}`);
        });
}

function sendToMagentoQueue(request) {

    console.log("SNS", request);

    const params = {
        Message: JSON.stringify(request),
        Subject: `CustomerID: ${request.customer} (Royalty application ${request.operation})`,
        TopicArn: process.env.SNS_TOPIC_ROYALTY_SNS
    };

    return sns.publish(params).promise();
}
