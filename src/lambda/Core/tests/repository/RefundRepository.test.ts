import * as AWSMock from 'aws-sdk-mock';
import * as aws from 'aws-sdk';
import RefundRepository from '../../repository/RefundRepository';
import RefundItemEntity from '../../entity/RefundItemEntity';
import RefundOrderLineEntity from '../../entity/RefundOrderLineEntity';

const refundItem = require('../data/RefundItem.json');

describe('RefundRepository unit test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  const getRepository = () => {
    const db = new aws.DynamoDB.DocumentClient({ convertEmptyValues: true });
    return new RefundRepository(db);
  };

  it('should put refund', async () => {
    expect.assertions(1);
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Refunds') {
        expect(params).toStrictEqual({
          TableName: 'Refunds',
          Item: refundItem,
        });
      }

      callback(null, true);
    });

    await getRepository().refundOrder(getRefundItem());
  });

  it('should throw error', async () => {
    expect.assertions(2);
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Refunds') {
        expect(true).toEqual(true);
        callback(new Error('Refund error'), {});
      }
    });

    await expect(getRepository().refundOrder(getRefundItem())).rejects.toThrowError('Refund error');
  });
});

function getRefundItem() {
  const refundItemEntity = new RefundItemEntity();
  refundItemEntity.setID('a35c5fd3-9a83-4cb2-9a16-be2887ff08d1');
  refundItemEntity.setRefundID('OID-1111-35');
  refundItemEntity.setOrderNumber('1111');
  refundItemEntity.setPaymentMethod('worldpay');
  refundItemEntity.setRefundType('1');
  refundItemEntity.setRefundShipping('Yes');
  refundItemEntity.setIsException('false');
  refundItemEntity.setIsProcessed('Pending');
  refundItemEntity.setSource('OMS_Interface');
  refundItemEntity.setCreatedAt(1590062854503);
  refundItemEntity.setRefundedAt(0);

  const refundOrderLineEntity = new RefundOrderLineEntity();
  refundOrderLineEntity.setData('OID-1111-35');
  refundOrderLineEntity.setLineTotal('7.50000');
  refundOrderLineEntity.setProductSku('CLQ5180/42/70');
  refundOrderLineEntity.setQuantity('1.00000');
  refundItemEntity.setOrderLine(refundOrderLineEntity);

  return refundItemEntity;
}
