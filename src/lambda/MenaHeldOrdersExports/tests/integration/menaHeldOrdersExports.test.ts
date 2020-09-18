import * as AWSMock from 'aws-sdk-mock';

const lambda = require('../../index');
const orderV3OrderDBItem1 = require('../data/OrderV3OrderDBItem1.json');
const orderV3OrderDBItem2 = require('../data/OrderV3OrderDBItem2.json');
const orderV3MENAItems = require('../../../Core/tests/data/OrderV3MENAItems.json');
const lambdaSuccessResponse = require('../data/lambda-success-response.json');

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Order: {
          getById: (orderId) => {
            return orderId === '119-0679668-4245472' ? orderV3OrderDBItem1 : orderV3OrderDBItem2;
          },
        },
      },
    };
  },
  { virtual: true }
);

describe('MenaHeldOrdersExports integration test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  it('should return list of mena held orders', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      callback(null, {
        Items: orderV3MENAItems,
        LastEvaluatedKey: null,
      });
    });

    const response = await lambda.handler({ page: 'qwEkRdNaOps' });
    expect(response).toEqual(lambdaSuccessResponse);
  });

  it('should return list of mena held orders when put empty event', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      callback(null, {
        Items: orderV3MENAItems,
        LastEvaluatedKey: undefined,
      });
    });

    const response = await lambda.handler({ queryStringParameters: {}});
    expect(response).toEqual(lambdaSuccessResponse);
  });

  it('should return error', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      callback(new Error('error 123'));
    });

    const response = await lambda.handler({ page: 'qwEkRdNaOps' });
    expect(response).toEqual({
      "body": "{\"error\":\"error 123\"}",
      "isBase64Encoded": false,
      "statusCode": 500
    });
  });
});
