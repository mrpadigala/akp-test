export default class DeliveryEntity {
  private isRTO: boolean;

  private orderNumber: string;

  private status: string;

  private billingType: string;

  getOrderNumber(): string {
    return this.orderNumber;
  }

  getIsRTO(): boolean {
    return this.isRTO;
  }

  getStatus(): string {
    return this.status;
  }

  getBillingType(): string {
    return this.billingType;
  }

  setOrderNumber(orderNumber: string): void {
    this.orderNumber = orderNumber;
  }

  setIsRTO(isRTO: string): void {
    this.isRTO = isRTO.toLocaleLowerCase() === 'true';
  }

  setStatus(status: string): void {
    this.status = status.toLocaleLowerCase();
  }

  setBillingType(billingType: string): void {
    this.billingType = billingType;
  }

  isReturned(): boolean {
    return this.getIsRTO();
  }

  isDelivered(): boolean {
    return !this.getIsRTO() && this.getStatus() === 'delivered';
  }
}
