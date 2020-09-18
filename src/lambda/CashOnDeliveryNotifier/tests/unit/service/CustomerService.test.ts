import mockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import CustomerInformationClient from '../../../../Core/client/CCS/CustomerInformationClient';
import CustomerService from '../../../service/CustomerService';
import SsmClient from '../../../../Core/client/SsmClient';
import CustomerInformationConfig from '../../../../Core/client/CCS/CustomerInformationConfig';

const mockAxios = new mockAdapter(axios);

const endpoint = 'http://localhost';
const getCustomerService = () => {
  const ssmClient = new SsmClient(new AWS.SSM());
  const config = new CustomerInformationConfig(endpoint, '/oms/name-of-param', ssmClient);
  const customerInformationClient = new CustomerInformationClient(config);
  return new CustomerService(customerInformationClient);
};

function mockCustomerAPI(value) {
  mockAxios.onPost(`${endpoint}/34234-23431-21323-123/`).reply((config) => {
    expect(config.headers['x-api-key']).toEqual('key-customer-information');
    expect(JSON.parse(config.data)).toEqual({
      Item: {
        CashOnDeliveryApproved: value,
      },
    });

    return [
      200,
      {
        Success: true,
        Message: {
          Count: 1,
          ScannedCount: 1,
          Items: [
            {
              CashOnDeliveryApproved: value,
            },
          ],
        },
      },
    ];
  });
}

describe('CustomerService class', () => {
  AWSMock.mock('SSM', 'getParameter', (params, callback) => {
    callback(null, {
      Parameter: {
        Name: '/oms/name-of-param',
        Type: 'String',
        Value: 'key-customer-information',
      },
    });
  });

  it('should add customer to whitelist', async () => {
    mockCustomerAPI(true);
    await getCustomerService().addToWhitelist('34234-23431-21323-123');
  });

  it('should add customer to blacklist', async () => {
    mockCustomerAPI(false);
    await getCustomerService().addToBlacklist('34234-23431-21323-123');
  });
});
