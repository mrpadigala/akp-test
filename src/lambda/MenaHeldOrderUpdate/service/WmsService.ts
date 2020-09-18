const { mapOrderToWmsPayload } = require('./../../StateMachine/OrderProcessingDownstream/order_payload');

export default class WmsService {
  private sns;

  private readonly topicArn: string;

  constructor(sns: any, topicArn: string) {
    this.sns = sns;
    this.topicArn = topicArn;
  }

  public publishOrder(order): Promise<any> {
    const orderPayload = mapOrderToWmsPayload(order);
    const params = {
      Message: JSON.stringify(orderPayload, null, 2).replace(/\//g, '\\/'),
      Subject: `Order Number: ${orderPayload.OrderId} (Order Create)`,
      TopicArn: this.topicArn,
    };
    return this.sns.publish(params).promise();
  }
}
