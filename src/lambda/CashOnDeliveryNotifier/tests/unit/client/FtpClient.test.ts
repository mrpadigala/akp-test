import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import FtpClient from '../../../client/FtpClient';
import { Client as BasicFtp } from 'basic-ftp';
import Config from '../../../Config';
import SsmClient from '../../../../Core/client/SsmClient';

const ftpFileList = require('../../data/ftpFileInfoList.json');
const returnFtpFilesList = require('../../data/returnFtpFilesList.json');

const env = {
  CARRIER_FTP_HOST: '127.0.0.1',
  CARRIER_FTP_USER: 'user',
  CARRIER_FTP_PASSWORD_SSM_PARAM_NAME: 'password',
  CARRIER_FTP_PATH: '/bar/foo',
  CARRIER_FTP_SECURE_CONNECTION: 'false',
  CARRIER_S3_SYNC_BUCKET: 'bucket',
  CARRIER_S3_SYNC_PATH: 'asendia/import/',
};

jest.mock(
  'basic-ftp',
  () => {
    return {
      Client: function () {
        return {
          access: (options) => {
            return null;
          },
          downloadTo: (writable, file) => {
            if (file === 'download-with-exception') {
              throw new Error('Download error');
            }
            writable._write('column1, column2, column3', '', () => {});
            writable._write('11, 22, 33', '', () => {});
            writable._write('77, 66, 55', '', () => {});
            return null;
          },
          list: () => {
            return ftpFileList;
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

const getFtpClient = () => {
  const ssmClient = new SsmClient(new AWS.SSM());
  const config = new Config(env, ssmClient);
  return new FtpClient(new BasicFtp(25000), config);
};

describe('FtpClient class', () => {
  AWSMock.mock('SSM', 'getParameter', (params, callback) => {
    callback(null, {
      Parameter: {
        Name: '/oms/name-of-param',
        Type: 'String',
        Value: 'secret-key-value',
      },
    });
  });

  it('should download file from FTP and return string', async () => {
    const csv = await getFtpClient().download('path-to-file');
    expect(csv).toBe('column1, column2, column3\n11, 22, 33\n77, 66, 55');
  });

  it('should return list of files', async () => {
    const files = await getFtpClient().list('path-to-file');
    expect(files).toEqual(returnFtpFilesList);
  });
});
