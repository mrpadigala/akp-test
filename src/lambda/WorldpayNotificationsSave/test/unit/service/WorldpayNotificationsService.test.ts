import * as AWSMock from 'aws-sdk-mock';
import * as aws from 'aws-sdk';
import * as fs from 'fs';
import RequestService from '../../../service/RequestService';
import WorldpayNotificationsService from '../../../service/WorldpayNotificationsService';
import OrderV3NotificationRepository from '../../../../Core/repository/OrderV3NotificationRepository';

const OrderV3NotificationParam = require('../../data/OrderV3NotificationParam.json');
const validEvent = fs.readFileSync(__dirname + '/../../data/validEvent.xml', 'utf8');

describe('WorldpayNotificationsService unit test', () => {
  Date.now = jest.fn(() => new Date(Date.UTC(2020, 9, 11)).valueOf());

  afterEach(() => {
    AWSMock.restore();
  });

  const getService = () => {
    const db = new aws.DynamoDB.DocumentClient({ convertEmptyValues: true });
    return new WorldpayNotificationsService(new OrderV3NotificationRepository(db));
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

    const request = new RequestService(getEvent(validEvent));
    await getService().save(request);
    expect(fn).toBeCalledTimes(1);
  });
});

function getEvent(body) {
  return {
    body,
    headers: {},
    multiValueHeaders: {},
    httpMethod: '',
    isBase64Encoded: false,
    path: '',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: null,
    resource: ''
  }
}
