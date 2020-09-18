import BaseRepository from './BaseRepository';
import WorldpayNotificationEntity from '../entity/WorldpayNotificationEntity';
import IOrdersV3WorldpayNotification from '../interface/IOrdersV3WorldpayNotification';

export default class OrderV3NotificationRepository extends BaseRepository<any> {
  protected tableName = 'OrdersV3';

  public async create(item: WorldpayNotificationEntity): Promise<any> {
    return this.docClient
      .put({
        TableName: this.tableName,
        Item: this.buildRefundItem(item),
      })
      .promise();
  }

  private buildRefundItem(item: WorldpayNotificationEntity): IOrdersV3WorldpayNotification {
    return {
      OrderId: item.getOrderId(),
      AttributeId: item.getAttributeId(),
      Status: item.getStatus(),
      Timestamp: item.getTimestamp(),
      RawMessage: item.getRawMessage(),
    };
  }
}
