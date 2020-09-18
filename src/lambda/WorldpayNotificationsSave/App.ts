import WorldpayNotificationsService from './service/WorldpayNotificationsService';
import Core from '../Core/Core';
import RequestService from './service/RequestService';

export default class App {
  private readonly event;

  constructor(event) {
    this.event = event;
  }

  public getRequestService(): RequestService {
    return new RequestService(this.event);
  }

  public getWorldpayNotificationsService(): WorldpayNotificationsService {
    return new WorldpayNotificationsService(Core.getOrderV3NotificationRepository());
  }
}
