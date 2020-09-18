export default class WorldpayNotificationEntity {
  private orderId: string;

  private attributeId: string;

  private status: string;

  private timestamp: number;

  private rawMessage: string;

  public getOrderId(): string {
    return this.orderId;
  }

  public setOrderId(value: string) {
    this.orderId = value;
  }

  public getAttributeId(): string {
    return this.attributeId;
  }

  public setAttributeId(value: string) {
    this.attributeId = value;
  }

  public getStatus(): string {
    return this.status;
  }

  public setStatus(value: string) {
    this.status = value;
  }

  public getTimestamp(): number {
    return this.timestamp;
  }

  public setTimestamp(value: number) {
    this.timestamp = value;
  }

  public getRawMessage(): string {
    return this.rawMessage;
  }

  public setRawMessage(value: string) {
    this.rawMessage = value;
  }
}
