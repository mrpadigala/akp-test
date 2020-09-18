import { IEvent } from './index.type';
import FileTransferService from './service/FileTransferService';
import Core from '../Core/Core';
import RequestService from './service/RequestService';

export default class App {
  private readonly event: IEvent;

  constructor(event: IEvent) {
    this.event = event;
  }

  public getRequestService(): RequestService {
    return new RequestService(this.event);
  }

  public getFileTransferService(): FileTransferService {
    return new FileTransferService(Core.getS3Client(), Core.getConfig());
  }
}
