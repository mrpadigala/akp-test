import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import SsmClient from '../../client/SsmClient';

AWSMock.setSDKInstance(AWS);

describe('SSMClient unit test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  it('should return correct value', async () => {
    const fn = jest.fn();
    AWSMock.mock('SSM', 'getParameter', (params, callback) => {
      fn();
      callback(null, {
        Parameter: {
          Name: '/oms/name-of-param',
          Type: 'String',
          Value: 'secret-key-value',
        },
      });
    });

    const client = new SsmClient(new AWS.SSM());
    const value = await client.get('name-of-parameter');
    expect(value).toEqual('secret-key-value');
    expect(fn).toBeCalledTimes(1);
  });

  it('should throw error', async () => {
    const fn = jest.fn();
    AWSMock.mock('SSM', 'getParameter', (params, callback) => {
      fn();
      callback(new Error('ERROR!'), {});
    });

    const client = new SsmClient(new AWS.SSM());
    await expect(client.get('name-of-parameter')).rejects.toThrowError('ERROR!');
    expect(fn).toBeCalledTimes(1);
  });
});
