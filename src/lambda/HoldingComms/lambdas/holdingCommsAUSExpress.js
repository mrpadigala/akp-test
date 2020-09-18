'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const sendEmailsService = require('./../service/sendEmailsService');

const eventId = 8589;
const deliveryCode = 'flatrate15_flatrate15';
const days = 1;

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

