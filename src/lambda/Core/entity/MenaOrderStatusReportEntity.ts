import { ReportPaymentStatus, ReportStatus } from '../interface/IMenaOrderStatusReport';

export default class MenaOrderStatusReportEntity {
  private entityID = 'mena-order';

  private entityType: string;

  private orderNumber: string;

  private paymentStatus: ReportPaymentStatus;

  private status: ReportStatus;

  private createdAt: number;

  private ttl: number;

  public getEntityID(): string {
    return this.entityID;
  }

  public getEntityType(): string {
    return this.entityType;
  }

  public setEntityType(value: string) {
    this.entityType = value;
  }

  public getOrderNumber(): string {
    return this.orderNumber;
  }

  public setOrderNumber(value: string) {
    this.orderNumber = value;
  }

  public getPaymentStatus(): ReportPaymentStatus {
    return this.paymentStatus;
  }

  public setPaymentStatus(value: ReportPaymentStatus) {
    this.paymentStatus = value;
  }

  public getStatus(): ReportStatus {
    return this.status;
  }

  public setStatus(value: ReportStatus) {
    this.status = value;
  }

  public getCreatedAt(): number {
    return this.createdAt;
  }

  public setCreatedAt(value: number) {
    this.createdAt = value;
  }

  public getTTL(): number {
    return this.ttl;
  }

  public setTTL(value: number) {
    this.ttl = value;
  }
}
