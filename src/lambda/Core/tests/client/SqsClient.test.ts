import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import SqsClient from '../../client/SqsClient';

describe('SqsClient unit test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  it('should publish message', async () => {
    const fn = jest.fn();
    AWSMock.mock('SQS', 'sendMessage', (params, callback) => {
      expect(params).toEqual({
        MessageBody: '{"one":1,"two":2}',
        QueueUrl: 'queue-url'
      })
      fn();
      callback(null, {});
    });

    const client = new SqsClient(new AWS.SQS());
    await client.sendMessage('queue-url', {one: 1, two: 2});
    expect(fn).toBeCalledTimes(1);
  });

  it('should throw error', async () => {
    const fn = jest.fn();
    AWSMock.mock('SQS', 'sendMessage', (params, callback) => {
      fn();
      callback(new Error('ERROR!'), {});
    });

    const client = new SqsClient(new AWS.SQS());
    await expect(client.sendMessage('queue-url', {one: 1, two: 2})).rejects.toThrowError('ERROR!');
    expect(fn).toBeCalledTimes(1);
  });
});
