import * as AWS_MOCK from 'aws-sdk-mock';
import OrderTransferService from '../../../service/OrderTransferService';
import RequestService from '../../../service/RequestService';
import Core from '../../../../Core/Core';

const eventItemsArray = require('../../data/event-2-items.json');
const eventOrder = require('../../data/event-order.json');
const eventOrderDelete = require('../../data/event-order-delete.json');
const s3Params = require('../../data/s3-params.json');
const s3OrderParamsBody = require('../../data/s3-order-body.json');

describe('OrderTransferService unit test', () => {
  process.env.S3_PATH_TO_ORDERS = '/orders';
  process.env.S3_BUCKET_ORDER_STREAM_PROCESSOR = 'bucket-name-for-orders';

  Date.now = jest.fn(() => 1597300497000)

  beforeEach(() => {
    AWS_MOCK.restore();
  });

  it('uploads array of item', async () => {
    const fn = jest.fn();
    AWS_MOCK.mock('S3', 'putObject', (params, callback) => {
      expect(params).toStrictEqual(s3Params[params.Key]);

      fn();
      callback(null, {});
    });

    const request = new RequestService(eventItemsArray);
    const service = getOrderTransferService();
    await service.uploadAll(request.getRecords());
    expect(fn).toBeCalledTimes(2);
  });

  it('uploads order item', async () => {
    const fn = jest.fn();
    AWS_MOCK.mock('S3', 'putObject', (params, callback) => {
      expect(params.Bucket).toEqual('bucket-name-for-orders');
      expect(params.Key).toEqual('/orders/119-0679668-42454771/1597300497_Details-slash-test.json');
      expect(params.Body).toEqual(JSON.stringify(s3OrderParamsBody));

      fn();
      callback(null, {});
    });

    const request = new RequestService(eventOrder);
    const service = getOrderTransferService();
    await service.uploadAll(request.getRecords());
    expect(fn).toBeCalledTimes(1);
  });

  it('uploads removed order item', async () => {
    const fn = jest.fn();
    AWS_MOCK.mock('S3', 'putObject', (params, callback) => {
      expect(params.Bucket).toEqual('bucket-name-for-orders');
      expect(params.Key).toEqual('/orders/119-0679668-42454771/1597300497_Details-slash-test-deleted.json');
      expect(params.Body).toEqual(JSON.stringify(s3OrderParamsBody));

      fn();
      callback(null, {});
    });

    const request = new RequestService(eventOrderDelete);
    const service = getOrderTransferService();
    await service.uploadAll(request.getRecords());
    expect(fn).toBeCalledTimes(1);
  });
});

function getOrderTransferService() {
  return new OrderTransferService(Core.getS3Client(), Core.getConfig());
}
