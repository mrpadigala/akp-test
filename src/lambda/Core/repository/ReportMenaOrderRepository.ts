import BaseRepository from './BaseRepository';
import MenaOrderStatusReportEntity from '../entity/MenaOrderStatusReportEntity';
import IMenaOrderStatusReport from '../interface/IMenaOrderStatusReport';

export default class ReportMenaOrderRepository extends BaseRepository<any> {
  protected tableName = 'Reports';

  public async createStatus(item: MenaOrderStatusReportEntity): Promise<any> {
    return this.docClient
      .put({
        TableName: this.tableName,
        Item: this.buildStatusItem(item),
      })
      .promise();
  }

  private buildStatusItem(item: MenaOrderStatusReportEntity): IMenaOrderStatusReport {
    return {
      EntityId: item.getEntityID(),
      EntityType: item.getEntityType(),
      Data: {
        OrderNumber: item.getOrderNumber(),
        PaymentStatus: item.getPaymentStatus(),
        Status: item.getStatus(),
      },
      CreatedAt: item.getCreatedAt(),
      TTL: item.getTTL(),
    };
  }
}
