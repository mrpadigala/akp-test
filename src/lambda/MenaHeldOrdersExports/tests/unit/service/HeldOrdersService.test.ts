import * as AWSMock from 'aws-sdk-mock';
import HeldOrdersService from '../../../service/HeldOrdersService';
import OrderV3MenaHoldRepository from '../../../../Core/repository/OrderV3MenaHeldRepository';
import * as AWS from "aws-sdk";

const orderV3OrderDBItem1 = require('../../data/OrderV3OrderDBItem1.json');
const orderV3OrderDBItem2 = require('../../data/OrderV3OrderDBItem2.json');
const orderV3MENAItems = require('../../../../Core/tests/data/OrderV3MENAItems.json');
const menaHeldOrdersResponse = require('../../data/mena-held-orders-response.json');

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

describe('HeldOrdersService unit test', () => {
  function getService() {
    const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });
    const repository = new OrderV3MenaHoldRepository(docClient);
    return new HeldOrdersService(repository);
  }

  AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
    callback(null, {
      Items: orderV3MENAItems,
      LastEvaluatedKey: null,
    });
  });

  afterEach(() => {
    AWSMock.restore();
  });

  beforeEach(() => {

  });

  it('should return list of mena held orders', async () => {
    const response = await getService().list();
    expect(response).toEqual(menaHeldOrdersResponse);
  });
});
