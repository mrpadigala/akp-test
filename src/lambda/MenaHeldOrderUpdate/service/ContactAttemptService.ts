// @ts-ignore
import { OMS } from 'plt-layer';
import * as SQS from 'aws-sdk/clients/sqs';
import SqsClient from '../../Core/client/SqsClient';
import IOrderV3Layer from '../../Core/interface/IOrderV3Layer';
import Config from '../../Core/Config';
import OrderV3MenaHeldRepository from '../../Core/repository/OrderV3MenaHeldRepository';
import RequestService from './RequestService';

export default class ContactAttemptService {
  private sqsClient: SqsClient;

  private config: Config;

  private orderMenaHeldRepository: OrderV3MenaHeldRepository;

  constructor(sqsClient: SqsClient, config: Config, orderMenaHeldRepository: OrderV3MenaHeldRepository) {
    this.sqsClient = sqsClient;
    this.config = config;
    this.orderMenaHeldRepository = orderMenaHeldRepository;
  }

  public async contact(request: RequestService): Promise<any[]> {
    const order: IOrderV3Layer = await OMS.Order.getById(request.getOrderId());
    const payload = {
      firstName: order.CustomerDetails.FirstName,
      orderNumber: order.OrderId,
      domain: order.Domain,
      address: this.getDeliveryAddress(order),
    };
    const menaHeldContactAttempts = Number(order.MenaHeldContactAttempts);
    const count = Number.isNaN(menaHeldContactAttempts) ? 1 : menaHeldContactAttempts + 1;

    return Promise.all([
      this.orderMenaHeldRepository.updateContactAttempts(request.getOrderId(), count),
      this.sendEmail(order.Email, payload),
      this.setActivityLog(request.getOrderId(), 'Contact attempt', request.getUsername()),
    ]);
  }

  private getDeliveryAddress(order) {
    const addresses = [];
    const deliveryAddress = {};

    ['Street', 'City', 'Postcode', 'CountryCode'].forEach((value) => {
      const addressLine = order.ShippingDetails.Address[value];
      if (addressLine) {
        addresses.push(addressLine);
      }
    });

    for (let i = 1; i <= 4; i++) {
      deliveryAddress[`line${i}`] = addresses[i - 1] ? addresses[i - 1] : null;
    }

    return deliveryAddress;
  }

  private sendEmail(to: string, payload: any): Promise<SQS.Types.SendMessageResult> {
    const message = {
      key_id: '3',
      event_id: this.config.get('EMAIL_TEMPLATE_ID'),
      external_id: to,
      data: payload,
    };

    return this.sqsClient.sendMessage(this.config.get('SQS_EMAIL_QUEUE_URL'), message);
  }

  private async setActivityLog(orderId, message, username: string): Promise<any> {
    return OMS.Log.add(orderId, {
      Comment: message,
      Type: 'Mena Order',
      User: username,
      LogData: {},
    });
  }
}
