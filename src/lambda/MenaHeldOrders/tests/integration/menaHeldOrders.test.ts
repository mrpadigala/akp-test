import * as AWSMock from 'aws-sdk-mock';

const lambda = require('../../index');
const orderV3OrderDBItem = require('../data/OrderV3OrderDBItem.json');
const orderV3MENAItems = require('../../../Core/tests/data/OrderV3MENAItems.json');
const lambdaSuccessResponse = require('../data/lambda-success-response.json');

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Order: {
          getById: () => {
            return orderV3OrderDBItem;
          },
        },
      },
    };
  },
  { virtual: true }
);

describe('MenaHeldOrders integration test', () => {
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
