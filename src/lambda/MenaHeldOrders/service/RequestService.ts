import { IEvent } from '../index.type';

export default class RequestService {
  private event: IEvent;

  constructor(event, defaultValues = {}) {
    this.event = { ...defaultValues, ...event };
  }

  public getPage(): string {
    return this.event.page;
  }
}
