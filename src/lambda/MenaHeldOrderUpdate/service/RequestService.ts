import RequestValidator from './RequestValidator';
import { IEventBody } from '../index.type';

export default class RequestService {
  private readonly event: IEventBody;

  private readonly requestValidator: RequestValidator;

  constructor(event) {
    this.event = event;
    this.requestValidator = new RequestValidator();
    this.validate();
  }

  public getAction(): string {
    return this.event.action;
  }

  public getOrderId(): string {
    return this.event.orderId;
  }

  public getUsername(): string {
    return this.event.username;
  }

  public getData(): Object {
    return this.event;
  }

  public validate(): void {
    this.requestValidator.validate(this.event);
  }
}
