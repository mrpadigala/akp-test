const { mapOrderToSagePayload } = require('./../../StateMachine/OrderProcessingDownstream/order_payload');

export default class SageService {
  private sns;

  private readonly topicArn: string;

  constructor(sns: any, topicArn: string) {
    this.sns = sns;
    this.topicArn = topicArn;
  }

  public publishCancelledOrder(order): Promise<any> {
    const orderPayload = mapOrderToSagePayload(order);
    orderPayload.OrderAttributes.OrderStatus = 'Cancelled';
    orderPayload.OrderAttributes.Instructions = 'Cancelled';

    const params = {
      Message: JSON.stringify(orderPayload, null, 2).replace(/\//g, '\\/'),
      Subject: `Order Number: ${orderPayload.OrderId} (Order Cancellation)`,
      TopicArn: this.topicArn,
    };
    return this.sns.publish(params).promise();
  }
}
