import { IEvent, IFile } from '../index.type';

export default class RequestService {
  private event: IEvent;

  constructor(event: IEvent) {
    this.event = event;
    this.validation();
  }

  private validation() {
    if (this.event.Records[0].eventName !== 'ObjectCreated:Put') {
      throw new Error('Wrong event name');
    }
  }

  public getFile(): IFile {
    const record = this.event.Records[0];
    return {
      bucket: record.s3.bucket.name,
      filename: record.s3.object.key,
    };
  }
}
