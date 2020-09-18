import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import mockAdapter from 'axios-mock-adapter';
import axios from 'axios';
const mockAxios = new mockAdapter(axios);
import CustomerInformationClient from '../../client/CCS/CustomerInformationClient';
import SsmClient from "../../client/SsmClient";
import CustomerInformationConfig from "../../client/CCS/CustomerInformationConfig";

const endpoint = 'http://localhost';
const getCustomerInformationClient = () => {
  const ssmClient = new SsmClient(new AWS.SSM());
  const config = new CustomerInformationConfig(endpoint, '/oms/name-of-param', ssmClient);
  return new CustomerInformationClient(config);
};

describe('CustomerInformationClient class', () => {
  beforeEach(() => {
    AWSMock.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, {
        Parameter: {
          Name: '/oms/name-of-param',
          Type: 'String',
          Value: 'private-key',
        },
      });
    });
  });

  it('should set data', async () => {
    mockAxios.onPost(`${endpoint}/1231-3213-2344/`).reply((config) => {
      expect(config.headers['x-api-key']).toEqual('private-key');
      expect(JSON.parse(config.data)).toEqual({
        Item: {
          CashOnDeliveryApproved: true,
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
                CashOnDeliveryApproved: true,
              },
            ],
          },
        },
      ];
    });

    await getCustomerInformationClient().setCashOnDeliveryApproved('1231-3213-2344', true);
  });

  it('should throw error', async () => {
    mockAxios.onPost(`${endpoint}/1231-3213-2344/`).reply((config) => {
      expect(config.headers['x-api-key']).toEqual('private-key');
      expect(JSON.parse(config.data)).toEqual({
        Item: {
          CashOnDeliveryApproved: false,
        },
      });

      return [
        500,
        {
          Success: false,
          Message: {
            Error: 'error message',
          },
        },
      ];
    });
    const error = new Error('Request failed with status code 500');
    await expect(getCustomerInformationClient().setCashOnDeliveryApproved('1231-3213-2344', false)).rejects.toThrow(error);
  });
});
