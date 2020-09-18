import IOrderV3MENAItem from '../interface/IOrderV3MENAItem';
import OrderV3MenaHeldEntity from '../entity/OrderV3MenaHeldEntity';
import BaseRepository from './BaseRepository';

export default class OrderV3MenaHeldRepository extends BaseRepository<any> {
  protected tableName = 'OrdersV3';

  public async menaRemoveHeldOrder(orderId) {
    return this.docClient.delete({
      TableName: this.tableName,
      Key: {
        OrderId: orderId,
        AttributeId: 'MENA#Held',
      },
    }).promise();
  }

  public async menaHeldOrdersList(
    page = null,
    limit = null,
  ): Promise<{ items: OrderV3MenaHeldEntity[]; LastEvaluatedKey: string }> {
    const params = {
      TableName: this.tableName,
      IndexName: 'IndexAttributeId',
      KeyConditionExpression: '#AttributeId = :AttributeId',
      ExpressionAttributeNames: {
        '#AttributeId': 'AttributeId',
      },
      ExpressionAttributeValues: {
        ':AttributeId': 'MENA#Held',
      },
      ExclusiveStartKey: page !== null ? this.decodePageToken(page) : null,
    };

    if (limit !== null) {
      // @ts-ignore
      params.Limit = limit;
    }

    const data = await this.docClient.query(params).promise();

    return {
      items: data.Items.map(item => this.mappingMENAHeldItem(item)),
      LastEvaluatedKey: data.LastEvaluatedKey ? this.encodePageToken(data.LastEvaluatedKey) : null,
    };
  }

  private encodePageToken(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  private decodePageToken(str: string): any {
    return JSON.parse(Buffer.from(str, 'base64').toString('utf8'));
  }

  public async updatePaidStatus(orderNumber: string, status: boolean): Promise<any> {
    return this.docClient.update({
      Key: {
        OrderId: orderNumber,
        AttributeId: 'Details',
      },
      TableName: this.tableName,
      UpdateExpression: 'SET PaymentDetails.Paid = :paid',
      ExpressionAttributeValues: {
        ':paid': status,
      },
      ConditionExpression: 'attribute_exists(OrderId)',
    }).promise();
  }

  public updateContactAttempts(orderNumber: string, value: number): Promise<any> {
    return this.docClient.update({
      Key: {
        OrderId: orderNumber,
        AttributeId: 'MENA#Held',
      },
      TableName: this.tableName,
      UpdateExpression: 'SET ContactAttempts = :ContactAttempts',
      ExpressionAttributeValues: {
        ':ContactAttempts': value,
      },
      ConditionExpression: 'attribute_exists(OrderId)',
    }).promise();
  }

  private mappingMENAHeldItem(item: IOrderV3MENAItem): OrderV3MenaHeldEntity {
    const orderV3MenaHeldEntity = new OrderV3MenaHeldEntity();
    orderV3MenaHeldEntity.setOrderId(item.OrderId);
    orderV3MenaHeldEntity.setAttributeId(item.AttributeId);
    orderV3MenaHeldEntity.setCreatedAt(item.CreatedAt);
    orderV3MenaHeldEntity.setReason(item.Reason);

    return orderV3MenaHeldEntity;
  }
}
