'use strict';

const AWS = require('aws-sdk-mock');
const moment = require('moment');

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Order: {
          getById: jest.fn(),
        },
      },
    };
  },
  { virtual: true },
);
const { OMS } = require('plt-layer');

const holdingCommsFRStandard = require('../lambdas/holdingCommsFRStandard');
const holdingCommsFRExpress = require('../lambdas/holdingCommsFRExpress');
const holdingCommsAUSExpress = require('../lambdas/holdingCommsAUSExpress');
const holdingCommsAUSStandard = require('../lambdas/holdingCommsAUSStandard');
const holdingCommsIRENextDay = require('../lambdas/holdingCommsIRENextDay');
const holdingCommsIREStandard = require('../lambdas/holdingCommsIREStandard');
const holdingCommsUKINTStandard = require('../lambdas/holdingCommsUKINTStandard');
const holdingCommsUKIRERoyalty = require('../lambdas/holdingCommsUKIRERoyalty');
const holdingCommsUSExpress = require('../lambdas/holdingCommsUSExpress');
const holdingCommsUSStandard = require('../lambdas/holdingCommsUSStandard');
const order = require('./data/order');
const refundedOrder = require('./data/refundedOrder');
const notShippedIndexDBItem = require('./data/notShippedIndexDBItem');
const expectedMessage = require('./data/expectedMessage');

const config = {
  frStandard: { eventId: 8591, days: 3, shippingMethod: 'flatrate22_flatrate22' },
  frExpress: { eventId: 8591, days: 2, shippingMethod: 'flatrate23_flatrate23' },
  ausExpress: { eventId: 8589, days: 1, shippingMethod: 'flatrate15_flatrate15' },
  ausStandard: { eventId: 8589, days: 3, shippingMethod: 'flatrate19_flatrate19' },
  ireNextDay: { eventId: 8587, days: 2, shippingMethod: 'flatrate9_flatrate9' },
  ireStandard: { eventId: 8587, days: 3, shippingMethod: 'flatrate8_flatrate8' },
  ukINTStandard: { eventId: 7611, days: 3, shippingMethod: 'flatrate4_flatrate4' },
  usExpress: { eventId: 8588, days: 2, shippingMethod: 'flatrate11_flatrate11' },
  usStandard: { eventId: 8588, days: 3, shippingMethod: 'flatrate12_flatrate12' },
  ukRoyalty: { eventId: 7611, days: 2, shippingMethod: 'pltshipping_pltshipping' },
  ireRoyalty: { eventId: 8663, days: 2, shippingMethod: 'pltshipping_pltshipping' },
};

const {
  describe, beforeEach, afterEach, it, expect, process,
} = global;

describe('test handlers', () => {
  afterEach(() => {
    AWS.restore();
  });

  beforeEach(() => {
    process.env.SQS_QUEUE_URL = 'PLT-ScheduledEmail-Emarsys';
    OMS.Order.getById.mockImplementation(() => {
      return order;
    });
  });

  describe('test holdingCommsFRStandard handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.frStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.frStandard.shippingMethod}-${getDate(config.frStandard.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsFRStandard.handler();
    });

    it('Should not send email with virtual product', async () => {
      expect.assertions(1);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(true).toEqual(false);
        callback();
      });

      const newOrder = JSON.parse(JSON.stringify(order));
      newOrder.Items = [{
        Sku: 'YEARLY-SUBSCRIPTION-US',
      }];

      OMS.Order.getById.mockReset();
      OMS.Order.getById.mockImplementation(() => {
        return newOrder;
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.frStandard.shippingMethod}-${getDate(config.frStandard.days)}`);

          callback(null, { Count: 1, Items: [notShippedIndexDBItem] });
        }
      });

      await holdingCommsFRStandard.handler();
    });

    it('Should not send email with refunded order', async () => {
      expect.assertions(1);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(true).toEqual(false);
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.frStandard.shippingMethod}-${getDate(config.frStandard.days)}`);

          callback(null, { Count: 1, Items: [notShippedIndexDBItem] });
        }
      });
      OMS.Order.getById.mockReset();
      OMS.Order.getById.mockImplementation(() => {
        return refundedOrder;
      });

      await holdingCommsFRStandard.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.frStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsFRStandard.handler();
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
        await holdingCommsFRStandard.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsAUSExpress handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ausExpress.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ausExpress.shippingMethod}-${getDate(config.ausExpress.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsAUSExpress.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ausExpress.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsAUSExpress.handler();
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
        await holdingCommsAUSExpress.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsAUSStandard handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ausStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ausStandard.shippingMethod}-${getDate(config.ausStandard.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsAUSStandard.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ausStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsAUSStandard.handler();
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
        await holdingCommsAUSStandard.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsFRExpress handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.frExpress.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.frExpress.shippingMethod}-${getDate(config.frExpress.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsFRExpress.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.frExpress.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsFRExpress.handler();
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
        await holdingCommsFRExpress.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsIRENextDay handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ireNextDay.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ireNextDay.shippingMethod}-${getDate(config.ireNextDay.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsIRENextDay.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ireNextDay.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsIRENextDay.handler();
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
        await holdingCommsIRENextDay.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsIREStandard handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ireStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ireStandard.shippingMethod}-${getDate(config.ireStandard.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsIREStandard.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ireStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsIREStandard.handler();
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
        await holdingCommsIREStandard.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsUKINTStandard handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ukINTStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ukINTStandard.shippingMethod}-${getDate(config.ukINTStandard.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsUKINTStandard.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ukINTStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsUKINTStandard.handler();
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
        await holdingCommsUKINTStandard.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsUSStandard handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.usStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.usStandard.shippingMethod}-${getDate(config.usStandard.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsUSStandard.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.usStandard.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsUSStandard.handler();
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
        await holdingCommsUSStandard.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsUSExpress handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.usExpress.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.usExpress.shippingMethod}-${getDate(config.usExpress.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsUSExpress.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.usExpress.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsUSExpress.handler();
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
        await holdingCommsUSExpress.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });

  describe('test holdingCommsUKIRERoyalty handler', () => {
    it('Positive - email message correct', async () => {
      expect.assertions(2);
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ukRoyalty.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ukRoyalty.shippingMethod}-${getDate(config.ukRoyalty.days)}`);
          callback(null, { Count: 1, Items: [order] });
        }
      });

      await holdingCommsUKIRERoyalty.handler();
    });

    it('Does not send IRE', async () => {
      expect.assertions(1);

      const newOrder = JSON.parse(JSON.stringify(order));
      newOrder.StoreId = '3';

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ireRoyalty.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(params.ExpressionAttributeValues[':orderDate'])
            .toEqual(`${config.ireRoyalty.shippingMethod}-${getDate(config.ireRoyalty.days)}`);

          callback(null, { Count: 1, Items: [newOrder] });
        }
      });

      OMS.Order.getById.mockImplementation(() => {
        return newOrder;
      });

      await holdingCommsUKIRERoyalty.handler();
    });

    it('Positive - email message correct with LastEvaluatedKey', async () => {
      let iteration = 1;

      expect.assertions(2);

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(getMessage(config.ukRoyalty.eventId));
        callback();
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          const response = { Count: 1, Items: [order] };
          if (iteration === 1) {
            response.LastEvaluatedKey = iteration;
          }
          iteration++;
          callback(null, response);
        }
      });

      await holdingCommsUKIRERoyalty.handler();
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
        await holdingCommsUKIRERoyalty.handler();
      } catch (err) {
        expect(err).toEqual('Some aws error');
      }
    });
  });
});

function getMessage(eventId) {
  const message = JSON.parse(JSON.stringify(expectedMessage));
  message.event_id = eventId;
  return message;
}

function getDate(days) {
  return moment().subtract(days, 'day').format('YYYY-MM-DD');
}
