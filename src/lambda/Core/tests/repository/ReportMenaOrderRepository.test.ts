import * as AWSMock from 'aws-sdk-mock';
import * as aws from 'aws-sdk';
import ReportMenaOrderRepository from '../../repository/ReportMenaOrderRepository';
import MenaOrderStatusReportEntity from '../../entity/MenaOrderStatusReportEntity';
import { ReportPaymentStatus, ReportStatus } from '../../interface/IMenaOrderStatusReport';

const reportItem = require('../data/ReportMenaOrderPutItem.json');

describe('ReportMenaOrderRepository unit test', () => {
  afterEach(() => {
    AWSMock.restore();
  });

  const getRepository = () => {
    const db = new aws.DynamoDB.DocumentClient({ convertEmptyValues: true });
    return new ReportMenaOrderRepository(db);
  };

  it('should put report item', async () => {
    expect.assertions(1);
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Reports') {
        expect(params).toStrictEqual(reportItem);
      }

      callback(null, true);
    });

    await getRepository().createStatus(getReportEntity());
  });

  it('should throw error', async () => {
    expect.assertions(2);
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      if (params.TableName === 'Reports') {
        expect(true).toEqual(true);
        callback(new Error('Report put error'), {});
      }
    });

    await expect(getRepository().createStatus(getReportEntity())).rejects.toThrowError('Report put error');
  });
});

function getReportEntity() {
  const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
  menaOrderStatusReportEntity.setEntityType('status#2020-06-16-11-46#UUID');
  menaOrderStatusReportEntity.setOrderNumber('12312-123123-123123-123');
  menaOrderStatusReportEntity.setPaymentStatus(ReportPaymentStatus.Paid);
  menaOrderStatusReportEntity.setStatus(ReportStatus.Delivered);
  menaOrderStatusReportEntity.setCreatedAt(1591273755047);
  menaOrderStatusReportEntity.setTTL(1622809755);

  return menaOrderStatusReportEntity;
}
