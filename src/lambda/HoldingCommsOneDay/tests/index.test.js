'use strict';

const AWS = require('aws-sdk-mock');

jest.mock(
    "plt-layer",
    () => {
      return {
        OMS: {
          Order: {
            getById: jest.fn()
          }
        }
      };
    },
    { virtual: true }
);
const { OMS } = require('plt-layer');

const lambdaFunc = require('../index');
const order = require('./data/order');
const expectedMessage = require('./data/expectedMessage');

const {
  describe, beforeEach, afterEach, it, expect, process
} = global;

describe('test handler', () => {
  afterEach(() => {
    AWS.restore();
  });

  beforeEach(() => {
    process.env.SQS_QUEUE_URL = 'PLT-ScheduledEmail-Emarsys';
    OMS.Order.getById.mockImplementation(() => {
      return order;
    });
  });

  it('Positive - email message correct', async () => {
    expect.assertions(2);
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody)).toEqual(expectedMessage);
      callback();
    });

    AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        callback(null, { Count: 1, Items: [order] });
      }
    });

    await lambdaFunc.handler();
  });

  it('Positive - email message correct with LastEvaluatedKey', async () => {
    let iteration = 1;

    expect.assertions(3);

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody)).toEqual(expectedMessage);
      callback();
    });

    AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        const response = { Count: 1, Items: [order] };
        if(iteration === 1) {
          response.LastEvaluatedKey = iteration;
        }
        iteration++;
        callback(null, response);
      }
    });

    await lambdaFunc.handler();
  });

  it('should throw an error', async () => {
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(true).toEqual(false);
      callback();
    });

    AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        callback('Some aws error');
      }
    });

    try {
      await lambdaFunc.handler();
    } catch (err) {
      expect(err).toEqual('Some aws error');
    }
  });
});
