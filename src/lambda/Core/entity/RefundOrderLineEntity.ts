export default class RefundOrderLineEntity {
  private data: string;

  private keyTable: string = null;

  private lineTotal: string;

  private productSku: string;

  private quantity: string;

  public getData(): string {
    return this.data;
  }

  public getKeyTable(): string {
    return this.keyTable;
  }

  public getLineTotal(): string {
    return this.lineTotal;
  }

  public getProductSku(): string {
    return this.productSku;
  }

  public getQuantity(): string {
    return this.quantity;
  }

  public setData(data: string): void {
    this.data = data;
  }

  public setKeyTable(keyTable: string): void {
    this.keyTable = keyTable;
  }

  public setLineTotal(lineTotal: string): void {
    this.lineTotal = lineTotal;
  }

  public setProductSku(productSku: string): void {
    this.productSku = productSku;
  }

  public setQuantity(quantity: string): void {
    this.quantity = quantity;
  }
}
