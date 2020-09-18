import Core from '../Core/Core';
import RequestService from './service/RequestService';
import { IEventBody } from './index.type';
import HeldOrdersService from './service/HeldOrdersService';
import WmsService from './service/WmsService';
import SageService from './service/SageService';
import ReportService from './service/ReportService';
import ContactAttemptService from './service/ContactAttemptService';

export default class App {
  private readonly core: Core;

  private readonly event: IEventBody;

  constructor(event) {
    this.event = Core.parseEventBody<IEventBody>(event);
    this.core = new Core();
  }

  public getHeldOrdersService(): HeldOrdersService {
    const sns = Core.getSns();
    return new HeldOrdersService(
      this.core.getOrdersV3Repository(),
      this.core.getRefundRepository(),
      new WmsService(sns, process.env.SNS_TOPIC_WMS_CREATE_ORDER),
      new SageService(sns, process.env.SNS_TOPIC_SAGE),
      this.getReportService(),
    );
  }

  public getRequestService(): RequestService {
    return new RequestService(this.event);
  }

  private getReportService(): ReportService {
    return new ReportService(this.core.getReportMenaOrderRepository());
  }

  public getContactAttemptService(): ContactAttemptService {
    return new ContactAttemptService(Core.getSqsClient(), Core.getConfig(), this.core.getOrdersV3Repository());
  }
}
