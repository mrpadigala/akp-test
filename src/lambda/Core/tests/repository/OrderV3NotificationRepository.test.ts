import * as AWSMock from 'aws-sdk-mock';
import * as aws from 'aws-sdk';
import OrderV3NotificationRepository from '../../repository/OrderV3NotificationRepository';
import WorldpayNotificationEntity from '../../entity/WorldpayNotificationEntity';

const OrderV3NotificationParam = require('../data/OrderV3NotificationParam.json');

describe('OrderV3NotificationRepository unit test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  const getRepository = () => {
    const db = new aws.DynamoDB.DocumentClient({ convertEmptyValues: true });
    return new OrderV3NotificationRepository(db);
  };

  it('should put item', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        expect(params).toStrictEqual(OrderV3NotificationParam);
      }

      callback(null, true);
    });

    await getRepository().create(getRefundItem());
    expect(fn).toBeCalledTimes(1);
  });

  it('should throw error', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        callback(new Error('Create error'), {});
      }
    });

    await expect(getRepository().create(getRefundItem())).rejects.toThrowError('Create error');
    expect(fn).toBeCalledTimes(1);
  });
});

function getRefundItem(): WorldpayNotificationEntity {
  const entity = new WorldpayNotificationEntity();
  entity.setOrderId('232432423-234234-234234-23434');
  entity.setAttributeId('Notification#Worldpay#2312312312');
  entity.setStatus('AUTHORISED');
  entity.setTimestamp(2312312312);
  entity.setRawMessage('<qwerty></qwerty>');

  return entity;
}
