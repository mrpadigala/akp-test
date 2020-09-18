import { IEvent, IRecord } from '../index.type';

export default class RequestService {
  private readonly records: IRecord[];

  constructor(event: IEvent) {
    this.records = event.Records;
  }

  public getRecords(): IRecord[] {
    return this.records;
  }
}
