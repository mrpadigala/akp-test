import * as AWS_MOCK from 'aws-sdk-mock';
import FileTransferService from '../../../service/FileTransferService';
import Core from '../../../../Core/Core';
import RequestService from '../../../service/RequestService';

const event = require('../../data/event.json');

jest.mock(
  '@google-cloud/storage',
  () => {
    return {
      Storage: function (options) {
        expect(options).toEqual({
          projectId: 'p12345',
          credentials: { client_email: 'qwerty@site.com', private_key: 'secret-key-value' },
        });
        return {
          bucket: (bucketName) => {
            expect(bucketName).toEqual('google-bucket-name');
            return {
              file: (filename) => {
                expect(filename).toEqual('/stage-dir/incoming/file1#qwerty.csv');
                return {
                  save: (body) => {
                    expect(body).toEqual('test body');
                    return null;
                  },
                };
              },
            };
          },
        };
      },
    };
  },
  { virtual: true }
);

function getService() {
  return new FileTransferService(Core.getS3Client(), Core.getConfig());
}

describe('FileTransferService class', () => {
  process.env.GOOGLE_CLOUD_PROJECT_ID = 'p12345';
  process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'qwerty@site.com';
  process.env.GOOGLE_CLOUD_SSM_PRIVATE_KEY = '/oms/private-key';
  process.env.GOOGLE_CLOUD_BUCKET = 'google-bucket-name';
  process.env.GOOGLE_CLOUD_PATH = '/stage-dir';

  it('should sync data from s3 to google storage', async () => {
    const fnS3 = jest.fn();
    const fnSsm = jest.fn();
    AWS_MOCK.mock('S3', 'getObject', (params, callback) => {
      expect(params).toStrictEqual({
        Bucket: 'plt-bucket',
        Key: 'incoming/file1#qwerty.csv',
      });

      fnS3();
      callback(null, { Body: 'test body' });
    });

    AWS_MOCK.mock('SSM', 'getParameter', (params, callback) => {
      fnSsm();
      callback(null, {
        Parameter: {
          Name: '/oms/private-key',
          Type: 'String',
          Value: 'secret-key-value',
        },
      });
    });

    const request = new RequestService(event);
    await getService().syncS3ToGoogleStorage(request.getRecords());

    expect(fnS3).toBeCalledTimes(1);
    expect(fnSsm).toBeCalledTimes(1);
  });
});
