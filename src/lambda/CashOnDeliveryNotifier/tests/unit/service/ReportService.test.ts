import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import * as uuid from 'uuid/v4';
import ReportService from '../../../service/ReportService';
import ReportMenaOrderRepository from '../../../../Core/repository/ReportMenaOrderRepository';

const reportReturned = require('../../data/reportReturned.json');
const reportDelivered = require('../../data/reportDelivered.json');

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

  it('should create report item as returned', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Reports') {
        fn();
        expect(params).toEqual(reportReturned);
      }
      callback(null, true);
    });
    await getService().addReturned('1234-56645-23143-234');

    expect(fn).toBeCalledTimes(1);
  });

  it('should create report item as Delivered', async () => {
    const fn = jest.fn();
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Reports') {
        fn();
        expect(params).toEqual(reportDelivered);
      }
      callback(null, true);
    });

    await getService().addDelivered('345345-234234-234324-42342');

    expect(fn).toBeCalledTimes(1);
  });
});
