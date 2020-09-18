import * as AWSMock from 'aws-sdk-mock';
import * as aws from 'aws-sdk';
import OrderV3MenaHoldRepository from '../../repository/OrderV3MenaHeldRepository';
import OrderV3MenaHeldEntity from '../../entity/OrderV3MenaHeldEntity';

const orderV3MENAItems = require('../data/OrderV3MENAItems.json');
const orderV3MENADBParams = require('../data/OrderV3MENADBParams.json');
const orderUpdateStatusParams = require('../data/OrderUpdateStatusParams.json');
const orderV3MENAWithPageDBParams = require('../data/OrderV3MENAWithPageDBParams.json');
const orderUpdateContactAttemptsParams = require('../data/orderUpdateContactAttemptsParams.json');

describe('OrderV3MenaHoldRepository unit test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  const getRepository = () => {
    const db = new aws.DynamoDB.DocumentClient({ convertEmptyValues: true });
    return new OrderV3MenaHoldRepository(db);
  };

  it('should get data', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        expect(params).toStrictEqual(orderV3MENADBParams);
      }

      callback(null, {
        Items: orderV3MENAItems,
        LastEvaluatedKey: null,
      });
    });

    const item1 = new OrderV3MenaHeldEntity();
    item1.setOrderId('119-0679668-4245472');
    item1.setAttributeId('MENA#Held');
    item1.setCreatedAt('2019-07-02T09:34:48.130Z');
    item1.setReason('reason1');
    const item2 = new OrderV3MenaHeldEntity();
    item2.setOrderId('119-2020228-9850842');
    item2.setAttributeId('MENA#Held');
    item2.setCreatedAt('2019-08-08T09:40:23.095Z');
    item2.setReason('reason2');

    const items = await getRepository().menaHeldOrdersList(null, 50);
    expect(items).toEqual({ items: [item1, item2], LastEvaluatedKey: null });
    expect(fn).toBeCalledTimes(1);
  });

  it('should update order status', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        expect(params).toStrictEqual(orderUpdateStatusParams);
      }

      callback(null, {});
    });

    await getRepository().updatePaidStatus('123-45345-7832-324234', true);
    expect(fn).toBeCalledTimes(1);
  });

  it('should update contact attempts', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        expect(params).toStrictEqual(orderUpdateContactAttemptsParams);
      }

      callback(null, {});
    });

    await getRepository().updateContactAttempts('123-45345-7832-324234', 5);
    expect(fn).toBeCalledTimes(1);
  });

  it('should get data with page token', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        expect(params).toStrictEqual(orderV3MENAWithPageDBParams);
      }

      callback(null, {
        Items: [],
        LastEvaluatedKey: {
          AttributeId: 'MENA#Held',
          CreatedTimestamp: 1589562379,
          OrderId: '1620-1362826-4242762',
        },
      });
    });

    const page = 'eyJBdHRyaWJ1dGVJZCI6Ik1FTkEjSGVsZCIsIkNyZWF0ZWRUaW1lc3RhbXAiOjE1ODk1NjIzNzksIk9yZGVySWQiOiIxNjIwLTEzNjI4MjYtNDI0Mjc2MiJ9';
    const items = await getRepository().menaHeldOrdersList(page, 50);
    expect(items.LastEvaluatedKey).toEqual(page);
    expect(fn).toBeCalledTimes(1);
  });

  it('should remove held order entity', async () => {
    const orderId = '1111';
    expect.assertions(1);
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        expect(params.Key).toStrictEqual({
          OrderId: orderId,
          AttributeId: 'MENA#Held',
        });
      }

      callback(null, {});
    });

    await getRepository().menaRemoveHeldOrder(orderId);
  });

  it('should throw error', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
      }

      callback(new Error('Error when reading'), {});
    });

    await expect(getRepository().menaHeldOrdersList(null)).rejects.toThrowError('Error when reading');
    expect(fn).toBeCalledTimes(1);
  });
});
