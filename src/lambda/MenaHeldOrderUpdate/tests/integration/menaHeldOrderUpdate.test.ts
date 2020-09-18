import * as AWSMock from 'aws-sdk-mock';
import * as uuid from 'uuid/v4';

Date.now = jest.fn(() => 1487076708999);
jest.mock('uuid/v4');
// @ts-ignore
uuid.mockImplementation(() => '86d0db01-cba5-45ce-981e-9841b0888999');

const lambda = require('../../index');
const order = require('../data/order.json');
const confirmationEvent = require('../data/confirmationEvent.json');
const confirmationEventOnlyMandatoryFields = require('../data/confirmationEventOnlyMandatoryFields.json');
const expectUpdateOrderParams = require('../data/expectUpdateOrderParams.json');
const expectUpdateOrderOnlyMandatoryParams = require('../data/expectUpdateOrderOnlyMandatoryParams.json');
const reportCancelledIntegrationTest = require('../data/reportCancelledIntegrationTest.json');

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Order: {
          getById: jest.fn(),
          updateOrder: jest.fn(),
        },
        Log: {
          add: jest.fn(),
        }
      },
    };
  },
  { virtual: true }
);

const { OMS } = require('plt-layer');

describe('MenaHeldOrderUpdate integration tests', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  describe('Confirmation tests', () => {
    beforeEach(() => {
      process.env.SNS_TOPIC_WMS_CREATE_ORDER = 'WMS';
      OMS.Order.getById.mockImplementation((orderId) => {
        return order;
      });
    });

    it('should update order and remove held order entity', async () => {
      expect.assertions(6);
      AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
        expect(true).toEqual(true);
        callback(null, );
      });

      OMS.Order.updateOrder.mockImplementation((id, params) => {
        expect(params).toEqual(expectUpdateOrderParams);
        return true;
      });

      AWSMock.mock("SNS", "publish", (params, callback) => {
        if (params.TopicArn === 'WMS') {
          const data = JSON.parse(params.Message);
          expect(data.OrderId).toEqual('1111');
        }
        callback();
      });

      OMS.Log.add.mockImplementation((orderId, message) => {
        expect(message.Comment).toEqual('Order approved');
        expect(message.User).toEqual('test username');
        return true;
      });

      const response = await lambda.handler(formatEvent(confirmationEvent));
      expect(response).toEqual(getSuccessResponse());
    });

    it('should return validation error', async () => {
      expect.assertions(6);
      const requiredFields = [
        'orderId',
        'country',
        'streetName',
        'city',
        'postcode',
        'phone',
      ];

      for (const field of requiredFields) {
        const event = JSON.parse(JSON.stringify(confirmationEvent));
        delete event[field];

        const response = await lambda.handler(formatEvent(event));
        expect(response).toEqual({
          "body": `{\"error\":\"${field} is missing - Unprocessable entity\"}`,
          "isBase64Encoded": false,
          "statusCode": 422
        });
      }
    });

    it('should return success without not mandatory fields', async () => {
      expect.assertions(2);
      AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
        callback(null, );
      });

      OMS.Order.updateOrder.mockImplementation((id, params) => {
        expect(params).toEqual(expectUpdateOrderOnlyMandatoryParams);
        return true;
      });

      AWSMock.mock("SNS", "publish", (params, callback) => {
        callback();
      });

      OMS.Log.add.mockImplementation((orderId, message) => true );

      const response = await lambda.handler(formatEvent(confirmationEventOnlyMandatoryFields));
      expect(response).toEqual(getSuccessResponse());
    });

    it('should return update order error', async () => {
      OMS.Order.updateOrder.mockImplementation((id, params) => {
        expect(params).toEqual(expectUpdateOrderParams);
        throw new Error('Error')
      });

      const response = await lambda.handler(formatEvent(confirmationEvent));
      expect(response).toEqual({
        "body": "{\"error\":\"Error\"}",
        "isBase64Encoded": false,
        "statusCode": 500
      });
    });
  });

  describe('Cancellation tests', () => {
    beforeEach(() => {
      process.env.SNS_TOPIC_SAGE = 'SAGE';
    });
    it('should refund order and remove held order entity', async () => {
      const event = {
        action: 'cancellation',
        orderId: '1111',
        username: 'test username',
      };

      expect.assertions(10);

      AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        if (params.TableName === 'Refunds') {
          expect(params.Item.OrderNumber).toEqual(event.orderId);
          callback(null, {});
        } if (params.TableName === 'Reports') {
          expect(params).toEqual(reportCancelledIntegrationTest);
          callback(null, true);
        } else {
          callback('error');
        }
      });

      OMS.Order.getById.mockImplementation((id) => {
        expect(id).toEqual(event.orderId);
        return order;
      });

      AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
        expect(true).toEqual(true);
        callback(null, );
      });

      OMS.Log.add.mockImplementation((orderId, message) => {
        expect(message.Comment).toEqual('Order cancelled');
        expect(message.User).toEqual('test username');
        return true;
      });

      AWSMock.mock("SNS", "publish", (params, callback) => {
        if (params.TopicArn === 'SAGE') {
          const data = JSON.parse(params.Message);
          expect(data.OrderId).toEqual('1111');
          expect(data.OrderAttributes.OrderStatus).toEqual('Cancelled');
          expect(data.OrderAttributes.Instructions).toEqual('Cancelled');
        }
        callback();
      });

      const response = await lambda.handler(formatEvent(event));
      expect(response).toEqual(getSuccessResponse());
    });
  });

  it('should return get order error', async () => {
    const event = {
      action: 'cancellation',
      orderId: '1111',
      username: 'test username',
    };

    OMS.Order.getById.mockImplementation(() => {
      throw new Error('Error')
    });

    const response = await lambda.handler(formatEvent(event));
    expect(response).toEqual({
      "body": "{\"error\":\"Error\"}",
      "isBase64Encoded": false,
      "statusCode": 500
    });
  });

  it('should return put refund error', async () => {
    const event = {
      action: 'cancellation',
      orderId: '1111',
      username: 'test username',
    };

    OMS.Order.getById.mockImplementation((id) => {
      expect(id).toEqual(event.orderId);
      return order;
    });

    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      expect(true).toEqual(true);
      callback(null, );
    });

    OMS.Log.add.mockImplementation((orderId, message) => {
      expect(message.Comment).toEqual('Order cancelled');
      expect(message.User).toEqual('test username');
      return true;
    });

    AWSMock.mock("SNS", "publish", (params, callback) => {
      callback();
    });

    AWSMock.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
      callback(new Error('Error'));
    });

    OMS.Order.getById.mockImplementation((id) => {
      return order;
    });

    const response = await lambda.handler(formatEvent(event));
    expect(response).toEqual({
      "body": "{\"error\":\"Error\"}",
      "isBase64Encoded": false,
      "statusCode": 500
    });
  });

  it('should return missing action error', async () => {
    const event = JSON.parse(JSON.stringify(confirmationEvent));
    delete event.action;

    const response = await lambda.handler(formatEvent(event));
    expect(response).toEqual({
      "body": `{\"error\":\"Action is missing\"}`,
      "isBase64Encoded": false,
      "statusCode": 500
    });
  });
});

function getSuccessResponse() {
  return {
    "body": "{\"Status\":\"Success\"}",
    "isBase64Encoded": false,
    "statusCode": 200
  };
}

function formatEvent(data) {
  return {
    body: JSON.stringify(data),
  }
}
