import { Client as BasicFtp } from 'basic-ftp';
import Core from '../Core/Core';
import OrderStatusService from './service/OrderStatusService';
import { IEvent } from './index.type';
import RequestService from './service/RequestService';
import FtpClient from './client/FtpClient';
import Config from './Config';
import FileTransferService from './service/FileTransferService';
import ReportService from './service/ReportService';
import CustomerService from './service/CustomerService';

export default class App {
  private readonly core: Core;

  private readonly event: IEvent;

  private config: Config;

  constructor(event: IEvent = null) {
    this.event = event;
    this.core = new Core();
    this.config = this.getConfig();
  }

  public getOrderStatusService(): OrderStatusService {
    const s3Client = Core.getS3Client();
    const ordersV3Repository = this.core.getOrdersV3Repository();
    const customerService = this.getCustomerService();
    const reportService = this.getReportService();
    return new OrderStatusService(s3Client, ordersV3Repository, customerService, reportService);
  }

  private getCustomerService(): CustomerService {
    const endpoint = this.config.getCustomerInformationApiEndpoint();
    const keyName = this.config.getCustomerInformationApiKeySsmName();
    return new CustomerService(this.core.getCustomerInformationClient(endpoint, keyName));
  }

  public getRequestService(): RequestService {
    return new RequestService(this.event);
  }

  public getFileTransferService(): FileTransferService {
    return new FileTransferService(this.getFtpClient(), Core.getS3Client(), this.getConfig());
  }

  private getFtpClient(): FtpClient {
    return new FtpClient(new BasicFtp(25000), this.getConfig());
  }

  private getConfig(): Config {
    return new Config(process.env, Core.getSsmClient());
  }

  private getReportService(): ReportService {
    return new ReportService(this.core.getReportMenaOrderRepository());
  }
}
