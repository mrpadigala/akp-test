'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const sendEmailsService = require('./../service/sendEmailsService');

const eventId = 8587;
const deliveryCode = 'flatrate8_flatrate8';
const days = 3;

exports.handler = async () => {
    const sqs = new AWS.SQS();
    const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

    try {
        await sendEmailsService.sendEmails(sqs, docClient, deliveryCode, eventId, days);
    } catch (e) {
        console.log(e);
        throw e;
    }

    return true;
};

