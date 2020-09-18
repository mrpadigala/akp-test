import { IEvent } from './index.type';
import RequestService from './service/RequestService';
import OrderTransferService from './service/OrderTransferService';
import Core from '../Core/Core';

export default class App {
  private event: IEvent;

  constructor(event: IEvent) {
    this.event = event;
  }

  public getRequestService(): RequestService {
    return new RequestService(this.event);
  }

  public getOrderTransferService(): OrderTransferService {
    return new OrderTransferService(Core.getS3Client(), Core.getConfig());
  }
}
