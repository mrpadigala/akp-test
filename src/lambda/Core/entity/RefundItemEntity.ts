import RefundOrderLineEntity from './RefundOrderLineEntity';

export default class RefundItemEntity {
  private id: string;

  private refundID: string;

  private orderNumber: string;

  private paymentMethod: string;

  private refundType: string;

  private refundShipping: string;

  private source: string;

  private orderLines: RefundOrderLineEntity[] = [];

  private isException: string;

  private isProcessed: string;

  private createdAt: number;

  private refundedAt: number;

  public getID(): string {
    return this.id;
  }

  public getRefundID(): string {
    return this.refundID;
  }

  public getOrderNumber(): string {
    return this.orderNumber;
  }

  public getPaymentMethod(): string {
    return this.paymentMethod;
  }

  public getRefundType(): string {
    return this.refundType;
  }

  public getRefundShipping(): string {
    return this.refundShipping;
  }

  public getSource(): string {
    return this.source;
  }

  public getOrderLines(): RefundOrderLineEntity[] {
    return this.orderLines;
  }

  public getIsException(): string {
    return this.isException;
  }

  public getIsProcessed(): string {
    return this.isProcessed;
  }

  public getCreatedAt(): number {
    return this.createdAt;
  }

  public getRefundedAt(): number {
    return this.refundedAt;
  }

  public setID(id: string): void {
    this.id = id;
  }

  public setRefundID(refundID: string): void {
    this.refundID = refundID;
  }

  public setOrderNumber(orderNumber: string): void {
    this.orderNumber = orderNumber;
  }

  public setPaymentMethod(paymentMethod: string): void {
    this.paymentMethod = paymentMethod;
  }

  public setRefundType(refundType: string): void {
    this.refundType = refundType;
  }

  public setRefundShipping(refundShipping: string): void {
    this.refundShipping = refundShipping;
  }

  public setSource(source: string): void {
    this.source = source;
  }

  public setOrderLine(orderLine: RefundOrderLineEntity): void {
    this.orderLines.push(orderLine);
  }

  public setIsException(isException: string): void {
    this.isException = isException;
  }

  public setIsProcessed(isProcessed: string): void {
    this.isProcessed = isProcessed;
  }

  public setCreatedAt(createdAt: number): void {
    this.createdAt = createdAt;
  }

  public setRefundedAt(refundedAt: number): void {
    this.refundedAt = refundedAt;
  }
}
