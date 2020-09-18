import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import * as uuid from 'uuid/v4';
import ReportService from '../../../service/ReportService';
import ReportMenaOrderRepository from '../../../../Core/repository/ReportMenaOrderRepository';

const reportCancelled = require('../../data/reportCancelled.json');

Date.now = jest.fn(() => 1487076708999);
jest.mock('uuid/v4');
// @ts-ignore
uuid.mockImplementation(() => '86d0db01-cba5-45ce-981e-9841b0888999');

function getService() {
  const options = {
    apiVersion: '2012-08-10',
    convertEmptyValues: true,
  };
  const docClient = new AWS.DynamoDB.DocumentClient(options);
  const repository = new ReportMenaOrderRepository(docClient);
  return new ReportService(repository);
}

describe('ReportService class', () => {
  beforeEach(() => {
    AWSMock.restore();
  });

  it('should create report item as cancelled', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Reports') {
        fn();
        expect(params).toEqual(reportCancelled);
      }
      callback(null, true);
    });
    await getService().addCancelled('1234-56645-23143-234');

    expect(fn).toBeCalledTimes(1);
  });
});
