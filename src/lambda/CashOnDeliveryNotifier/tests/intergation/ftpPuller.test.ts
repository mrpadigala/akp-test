import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import * as moment from 'moment';

AWSMock.setSDKInstance(AWS);

jest.mock(
  'plt-layer',
  () => {
    return {
      OMS: {
        Log: {
          add: () => {},
        },
      },
    };
  },
  { virtual: true }
);

const ftpFileList = require('../data/ftpFileInfoList.json');
Date.now = jest.fn(() => 1487076708000);

process.env.CARRIER_FTP_HOST = '127.0.0.2';
process.env.CARRIER_FTP_USER = 'user';
process.env.CARRIER_FTP_PASSWORD_SSM_PARAM_NAME = 'password';
process.env.CARRIER_FTP_PATH = '/bar/foo';
process.env.CARRIER_FTP_SECURE_CONNECTION = 'true';
process.env.CARRIER_S3_SYNC_BUCKET = 'bucket';
process.env.CARRIER_S3_SYNC_PATH = 'asendia/import/';

let j = 0;
jest.mock(
  'basic-ftp',
  () => {
    return {
      Client: function () {
        return {
          access: (options) => {
            expect(options).toEqual({ host: '127.0.0.2', user: 'user', password: 'secret-key-value', secure: true });
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
  }
);

const lambda = require('../../ftpPuller');

describe('ftpPuller integration test', () => {
  beforeAll(() => {
    AWSMock.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, {
        Parameter: {
          Name: '/oms/name-of-param',
          Type: 'String',
          Value: 'secret-key-value',
        },
      });
    });
  });

  afterEach(() => {
    AWSMock.restore();
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
      callback(null, {});
    });

    await lambda.handler();
    expect(fn).toBeCalledTimes(2);
  });
});
