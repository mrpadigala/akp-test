import { IEvent, IEventRecord } from '../index.type';

export default class RequestService {
  private readonly records: IEventRecord[];

  constructor(event: IEvent) {
    this.records = event.Records;
  }

  public getRecords(): IEventRecord[] {
    return this.records;
  }
}
