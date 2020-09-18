import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

import Config from '../../Config';
import SsmClient from '../../../Core/client/SsmClient';

describe('Config unit test', () => {
  beforeEach(() => {
    AWSMock.restore();
  });

  it('returns carrier ftp host', async () => {
    const config = getConfig();
    expect(config.getCarrierFtpHost()).toEqual('127.0.0.1');
  });

  it('returns carrier ftp user', async () => {
    const config = getConfig();
    expect(config.getCarrierFtpUser()).toEqual('user');
  });

  it('returns carrier ftp path', async () => {
    const config = getConfig();
    expect(config.getCarrierFtpPath()).toEqual('/bar/foo');
  });

  it('returns carrier ftp password', async () => {
    const config = getConfig();
    expect(await config.getCarrierFtpPassword()).toEqual('ftp_pass_1');
  });

  it('returns carrier ftp secure connection', async () => {
    const config = getConfig();
    expect(await config.isCarrierSecureConnection()).toEqual(true);
  });

  it('returns carrier s3 bucket', async () => {
    const config = getConfig();
    expect(await config.getCarrierS3Bucket()).toEqual('bucket-name');
  });

  it('returns carrier s3 path', async () => {
    const config = getConfig();
    expect(await config.getCarrierS3Path()).toEqual('s3-path');
  });

  function getConfig() {
    const env = {
      CARRIER_FTP_HOST: '127.0.0.1',
      CARRIER_FTP_USER: 'user',
      CARRIER_FTP_PASSWORD_SSM_PARAM_NAME: 'password',
      CARRIER_FTP_PATH: '/bar/foo',
      CARRIER_FTP_SECURE_CONNECTION: 'true',
      CARRIER_S3_SYNC_BUCKET: 'bucket-name',
      CARRIER_S3_SYNC_PATH: 's3-path',
    };

    AWSMock.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, { Parameter: { Value: 'ftp_pass_1' } });
    });

    return new Config(env, new SsmClient(new AWS.SSM()));
  }
});
