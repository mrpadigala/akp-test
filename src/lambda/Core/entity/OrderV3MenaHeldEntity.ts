export default class OrderV3MenaHeldEntity {
  private orderId: string;

  private attributeId: string;

  private createdAt: string;

  private reason: string;

  public getOrderId(): string {
    return this.orderId;
  }

  public getAttributeId(): string {
    return this.attributeId;
  }

  public getCreatedAt(): string {
    return this.createdAt;
  }

  public getReason(): string {
    return this.reason;
  }

  public setOrderId(orderId: string): void {
    this.orderId = orderId;
  }

  public setAttributeId(attributeId: string): void {
    this.attributeId = attributeId;
  }

  public setCreatedAt(createdAt: string): void {
    this.createdAt = createdAt;
  }

  public setReason(reason: string): void {
    this.reason = reason;
  }
}
