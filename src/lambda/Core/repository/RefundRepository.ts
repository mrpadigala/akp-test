import BaseRepository from './BaseRepository';
import RefundItemEntity from '../entity/RefundItemEntity';
import IRefund from '../interface/IRefund';

export default class RefundRepository extends BaseRepository<any> {
  protected tableName = 'Refunds';

  public async refundOrder(item: RefundItemEntity): Promise<any> {
    return this.docClient.put({
      TableName: this.tableName,
      Item: this.buildRefundItem(item),
    }).promise();
  }

  private buildRefundItem(item: RefundItemEntity): IRefund {
    return {
      Id: item.getID(),
      RefundId: item.getRefundID(),
      OrderNumber: item.getOrderNumber(),
      PaymentMethod: item.getPaymentMethod(),
      RefundType: item.getRefundType(),
      RefundShipping: item.getRefundShipping(),
      Source: item.getSource(),
      OrderLines: item.getOrderLines().map(orderLine => ({
        Data: orderLine.getData(),
        KeyTable: orderLine.getKeyTable(),
        LineTotal: orderLine.getLineTotal(),
        ProductSku: orderLine.getProductSku(),
        Quantity: orderLine.getQuantity(),
      })),
      IsException: item.getIsException(),
      IsProcessed: item.getIsProcessed(),
      CreatedAt: item.getCreatedAt(),
      RefundedAt: item.getRefundedAt(),
    };
  }
}
