import * as AWSMock from 'aws-sdk-mock';
import ContactAttemptService from '../../../service/ContactAttemptService';
import Core from '../../../../Core/Core';
import RequestService from "../../../service/RequestService";

const order = require('../../data/order.json');
const orderUpdateStatusParams = require('../../data/orderUpdateStatusParams.json');

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Order: {
          getById: (orderId) => {
            expect(orderId).toEqual('12312312-123213-1233213');
            return order;
          },
        },
        Log: {
          add: (orderId, data) => {
            expect(orderId).toEqual('12312312-123213-1233213');
            expect(data).toEqual({
              Comment: 'Contact attempt',
              LogData: {},
              Type: 'Mena Order',
              User: 'test username',
            });
          },
        },
      },
    };
  },
  { virtual: true }
);

describe('ContactAttemptService unit test', () => {
  process.env.EMAIL_TEMPLATE_ID = '12345';
  process.env.SQS_EMAIL_QUEUE_URL = 'queue-url';

  afterEach(() => {
    AWSMock.restore();
  });

  it('should contact attempt', async () => {
    const fn = jest.fn();
    AWSMock.mock('SQS', 'sendMessage', (params, callback) => {
      expect(params).toEqual({
        MessageBody:
          '{"key_id":"3","event_id":"12345","external_id":"dmstest@mailinator.com","data":{"firstName":"Test","orderNumber":"119-2630542-9715070","domain":"staging.prettylittlething.com","address":{"line1":"5 Imperial House\\n12-14 Exchange Street","line2":"Aberdeen","line3":"AB11 6PH","line4":"GB"}}}',
        QueueUrl: 'queue-url',
      });
      fn();
      callback(null, {});
    });

    const fnDb = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fnDb();
        expect(params).toStrictEqual(orderUpdateStatusParams);
      }

      callback(null, {});
    });

    await getService().contact(getRequestService());

    expect(fn).toBeCalledTimes(1);
    expect(fnDb).toBeCalledTimes(1);
  });
});

function getService() {
  const core = new Core();
  return new ContactAttemptService(Core.getSqsClient(), Core.getConfig(), core.getOrdersV3Repository());
}

function getRequestService() {
  return  new RequestService({
    action: 'contact-attempt',
    orderId: '12312312-123213-1233213',
    username: 'test username',
  })
}
