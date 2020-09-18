import Core from '../Core/Core';
import RequestService from './service/RequestService';
import { IEvent } from './index.type';
import HeldOrdersService from './service/HeldOrdersService';

export default class App {
  private readonly core: Core;

  private readonly event: IEvent;

  constructor(event) {
    this.event = Core.parseEventQuery<IEvent>(event);
    this.core = new Core();
  }

  public getHeldOrdersService(): HeldOrdersService {
    return new HeldOrdersService(this.core.getOrdersV3Repository());
  }

  public getRequestService(): RequestService {
    return new RequestService(this.event, { page: null });
  }
}
