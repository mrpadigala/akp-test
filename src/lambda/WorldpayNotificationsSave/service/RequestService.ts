import { APIGatewayEvent } from 'aws-lambda';
import * as xmlJs from 'xml-js';
import Core from '../../Core/Core';

export default class RequestService {
  private readonly xml: string;

  private readonly orderId: string;

  private readonly status: string;

  constructor(event: APIGatewayEvent) {
    this.xml = event.body;
    const worldpayNotification = this.parseWorldpayNotification(this.xml);
    this.orderId = worldpayNotification.OrderCode;
    this.status = worldpayNotification.Status;
  }

  public getOrderId(): string {
    return this.orderId;
  }

  public getStatus(): string {
    return this.status;
  }

  public getRawMessage(): string {
    return this.xml;
  }

  private parseWorldpayNotification(xml): { OrderCode: string, Status: string } {
    const notification: any = xmlJs.xml2js(xml, {
      compact: true,
      attributesKey: 'attributes',
    });
    const notificationReply = notification.paymentService.notify;

    if (
      this.isNotExist(notificationReply)
      || this.isNotExist(notificationReply.orderStatusEvent)
      || this.isNotExist(notificationReply.orderStatusEvent.payment)
      || this.isNotExist(notificationReply.orderStatusEvent.payment.lastEvent)
      // eslint-disable-next-line no-underscore-dangle
      || this.isNotExist(notificationReply.orderStatusEvent.payment.lastEvent._text)
      || this.isNotExist(notificationReply.orderStatusEvent.attributes)
      || this.isNotExist(notificationReply.orderStatusEvent.attributes.orderCode)
    ) {
      Core.log('[ERROR] notification = ', notification);
      throw new Error('Parse status error');
    }

    // eslint-disable-next-line no-underscore-dangle
    const status = notificationReply.orderStatusEvent.payment.lastEvent._text;
    const orderCode = notificationReply.orderStatusEvent.attributes.orderCode;

    return {
      OrderCode: orderCode,
      Status: status,
    };
  }

  private isNotExist(val: any): boolean {
    return val === null || val === undefined;
  }
}
