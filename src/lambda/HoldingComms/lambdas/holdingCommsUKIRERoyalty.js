'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const { OMS } = require("plt-layer");

const sendEmailsService = require('./../service/sendEmailsService');

const eventIdUK = 7611;
const deliveryCode = 'pltshipping_pltshipping';
const days = 2;

exports.handler = async () => {
    const sqs = new AWS.SQS();
    const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

    try {
        let data;

        const params = sendEmailsService.getNotShippedQuery(deliveryCode, days);

        do {
            data = await docClient.query(params).promise();

            for (const order of data.Items) {
                await processUKOrder(
                    sqs,
                    order.OrderId,
                    eventIdUK
                );
            }
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (data.LastEvaluatedKey)
    } catch (e) {
        console.log(e);
        throw e;
    }

    return true;
};

function isUKOrder(order) {
    return order.StoreId === '1';
}

async function processUKOrder(sqs, orderNumber, eventId) {
    const order = await OMS.Order.getById(orderNumber);

    if (!isUKOrder(order)) {
        return Promise.resolve();
    }

    console.log(`Process order: ${orderNumber}`);
    return sendEmailsService.publishEmailToSQS(
        sqs,
        sendEmailsService.buildEmailMessage(order, eventId)
    );
}
