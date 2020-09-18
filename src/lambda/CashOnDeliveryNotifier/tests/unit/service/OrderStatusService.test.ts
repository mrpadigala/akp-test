import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import mockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import OrderStatusService from '../../../service/OrderStatusService';
import OrderV3MenaHoldRepository from '../../../../Core/repository/OrderV3MenaHeldRepository';
import S3Client from '../../../../Core/client/S3Client';
import RequestService from '../../../service/RequestService';
import CustomerInformationClient from '../../../../Core/client/CCS/CustomerInformationClient';
import CustomerService from '../../../service/CustomerService';
import CustomerInformationConfig from "../../../../Core/client/CCS/CustomerInformationConfig";
import SsmClient from "../../../../Core/client/SsmClient";
import ReportMenaOrderRepository from '../../../../Core/repository/ReportMenaOrderRepository';
import ReportService from "../../../service/ReportService";

const orderUpdateStatusParams1 = require('../../data/OrderUpdateStatusParams1.json');
const orderUpdateStatusParams2 = require('../../data/OrderUpdateStatusParams2.json');
const event = require('../../data/event.json');
const mockAxios = new mockAdapter(axios);

AWSMock.setSDKInstance(AWS);

function logMock(orderNumber) {
  let out = {};
  switch (orderNumber) {
    case '1233-42353-23237':
      out = {
        Comment: 'Mena Order was paid',
        LogData: {
          Status: 'MENA DELIVERED',
        },
        Type: 'Mena Order',
        User: 'OMS',
      };
      break;
    case '5656-4563-3423-234':
      out = {
        Comment: 'Mena Order was Returned to Origin',
        LogData: {
          Status: 'MENA RTO',
        },
        Type: 'Mena Order',
        User: 'OMS',
      };
      break;
    case '2343-2233-23434-234':
      out = {
        Comment: 'Mena Order was paid',
        LogData: {
          Status: 'MENA DELIVERED',
        },
        Type: 'Mena Order',
        User: 'OMS',
      };
      break;
  }

  return out;
}

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Log: {
          add: (orderNumber, obj) => {
            expect(obj).toEqual(logMock(orderNumber));
          },
        },
        Order: {
          getById: () => {
            return require('../../data/ordersV3.json');
          },
        },
      },
    };
  },
  { virtual: true }
);

const request = new RequestService(event);
const endpoint = 'http://localhost';

const getOrderStatusService = () => {
  const s3Client = new S3Client(new AWS.S3());
  const options = {
    apiVersion: '2012-08-10',
    convertEmptyValues: true,
  };
  const docClient = new AWS.DynamoDB.DocumentClient(options);
  const repository = new OrderV3MenaHoldRepository(docClient);
  const ssmClient = new SsmClient(new AWS.SSM());
  const config = new CustomerInformationConfig(endpoint, '/oms/name-of-param', ssmClient)
  const customerInformationClient = new CustomerInformationClient(config);
  const customerService = new CustomerService(customerInformationClient);
  const reportService = new ReportService(new ReportMenaOrderRepository(docClient));
  return new OrderStatusService(s3Client, repository, customerService, reportService);
};

describe('OrderStatusService class', () => {
  beforeEach(() => {
    let i = 0;
    AWSMock.mock('S3', 'getObject', (params, callback) => {
      expect(params).toStrictEqual({
        Bucket: 'plt-prod.cash-on-delivery.eu-west-1',
        Key: i % 2 ? 'incoming/file2.csv' : 'incoming/file1.csv',
      });
      i++;
      const body =
        `Reference, Is RTO, Package Status, Billing Type\n
        1233-42353-23237, FALSE, delivered, COD\n
        5656-4563-3423-234, TRUE,, COD\n
        2343-2233-23434-234, FALSE, delivered, COD\n
        6535-1643-6535-342, FALSE, delivered,\n
        , FALSE, delivered, COD\n`;
      callback(null, {Body: body});
    });

    AWSMock.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, {
        Parameter: {
          Name: '/oms/name-of-param',
          Type: 'String',
          Value: 'key-customer-information',
        },
      });
    });
  });

  afterEach(() => {
    AWSMock.restore();
  });

  it('should download file from S3 and process', async () => {
    const fn = jest.fn();
    const fnReport = jest.fn();
    let i = 0;
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      if (params.TableName === 'OrdersV3') {
        fn();
        if (i === 0) {
          expect(params).toStrictEqual(orderUpdateStatusParams1);
        }
        if (i === 1) {
          expect(params).toStrictEqual(orderUpdateStatusParams2);
        }
        i += 1;
      }

      callback(null, {});
    });

    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Reports') {
        fnReport();
      }
      callback(null, true);
    });

    const fnAxios = jest.fn();
    mockAxios.onPost(`${endpoint}/84cd6f9d-7a3e-4419-8c0d-362e17260d27/`).reply((config) => {
      fnAxios();
      expect(config.headers['x-api-key']).toEqual('key-customer-information');

      return [
        200,
        {
          Success: true,
          Message: {
            Count: 1,
            ScannedCount: 1,
            Items: [],
          },
        },
      ];
    });

    await getOrderStatusService().check(request.getFile());
    expect(fn).toBeCalledTimes(2);
    expect(fnReport).toBeCalledTimes(3);
    expect(fnAxios).toBeCalledTimes(3);
  });
});
