import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import FtpClient from '../../../client/FtpClient';
import { Client as BasicFtp } from 'basic-ftp';
import Config from '../../../Config';
import SsmClient from '../../../../Core/client/SsmClient';
import FileTransferService from '../../../service/FileTransferService';
import S3Client from '../../../../Core/client/S3Client';
import moment = require('moment');

const ftpFileList = require('../../data/ftpFileInfoList.json');
Date.now = jest.fn(() => 1487076708000);

const env = {
  CARRIER_FTP_HOST: '127.0.0.1',
  CARRIER_FTP_USER: 'user',
  CARRIER_FTP_PASSWORD_SSM_PARAM_NAME: 'password',
  CARRIER_FTP_PATH: '/bar/foo',
  CARRIER_FTP_SECURE_CONNECTION: 'false',
  CARRIER_S3_SYNC_BUCKET: 'bucket',
  CARRIER_S3_SYNC_PATH: 'asendia/import/',
};

let j = 0;
jest.mock(
  'basic-ftp',
  () => {
    return {
      Client: function () {
        return {
          access: (options) => {
            expect(options).toEqual({
              host: '127.0.0.1',
              password: 'secret-key-value',
              secure: false,
              user: 'user',
            });
            return null;
          },
          downloadTo: (writable) => {
            writable._write('test body', '', () => {});
            return null;
          },
          list: (path) => {
            expect(path).toEqual('/bar/foo');
            return ftpFileList;
          },
          remove: (path) => {
            expect(path).toEqual(`/bar/foo/test${j}.csv`);
            j++;
            return null;
          },
          close: () => {
            return null;
          },
        };
      },
    };
  },
  { virtual: true }
);

const getFileTransferService = () => {
  const ssmClient = new SsmClient(new AWS.SSM());
  const config = new Config(env, ssmClient);
  const ftpClient = new FtpClient(new BasicFtp(25000), config);
  const s3Client = new S3Client(new AWS.S3());

  return new FileTransferService(ftpClient, s3Client, config);
};

describe('FileTransferService class', () => {
  AWSMock.mock('SSM', 'getParameter', (params, callback) => {
    callback(null, {
      Parameter: {
        Name: '/oms/name-of-param',
        Type: 'String',
        Value: 'secret-key-value',
      },
    });
  });

  it('should sync files from FTP to S3', async () => {
    const fn = jest.fn();
    AWSMock.mock('S3', 'putObject', (params, callback) => {
      expect(params).toEqual({
        Bucket: 'bucket',
        Key: `asendia/import/${moment().format('YYYY-MM')}/test${j}1487076708000.csv`,
        Body: 'test body',
      });

      fn();
      callback(null, '');
    });

    await getFileTransferService().syncFtpToS3();
    expect(fn).toBeCalledTimes(2);
  });
});
