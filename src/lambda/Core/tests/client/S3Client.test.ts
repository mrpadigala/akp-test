import * as AWS from 'aws-sdk';
import * as AWS_MOCK from 'aws-sdk-mock';

import S3Client from '../../client/S3Client';

describe('S3Client Client Test', () => {
  beforeEach(() => {
    AWS_MOCK.restore();
  });

  it('should upload file to s3', async () => {
    const fn = jest.fn();

    AWS_MOCK.mock('S3', 'putObject', (params, callback) => {
      expect(params).toStrictEqual({
        Bucket: 'bucket-name',
        Key: 'filename1',
        Body: 'test body'
      });

      fn();
      callback(null, '');
    });

    const client = new S3Client(new AWS.S3());
    await client.upload('test body', 'filename1', 'bucket-name');

    expect(fn).toBeCalledTimes(1);
  });

  it('failed to upload file to s3', async () => {
    const fn = jest.fn();
    AWS_MOCK.mock('S3', 'putObject', (params, callback) => {
      fn();
      callback(new Error('s3 putObject error'), null);
    });

    const client = new S3Client(new AWS.S3());
    await expect(client.upload('test body', 'filename1', 'bucket-name')).rejects.toThrowError('s3 putObject error');
    expect(fn).toBeCalledTimes(1);
  });

  it('should download file from s3', async () => {
    const fn = jest.fn();

    AWS_MOCK.mock('S3', 'getObject', (params, callback) => {
      expect(params).toStrictEqual({
        Bucket: 'bucket-name',
        Key: 'filename1',
      });

      fn();
      callback(null, { Body: 'test body' });
    });

    const client = new S3Client(new AWS.S3());
    const body = await client.download('filename1', 'bucket-name');

    expect(body).toEqual('test body');
    expect(fn).toBeCalledTimes(1);
  });

  it('failed to upload file to s3', async () => {
    const fn = jest.fn();
    AWS_MOCK.mock('S3', 'getObject', (params, callback) => {
      fn();
      callback(new Error('s3 getObject error'), null);
    });

    const client = new S3Client(new AWS.S3());
    await expect(client.download('filename1', 'bucket-name')).rejects.toThrowError('s3 getObject error');
    expect(fn).toBeCalledTimes(1);
  });
});
