import RefundItemEntity from '../../entity/RefundItemEntity';
import RefundOrderLineEntity from '../../entity/RefundOrderLineEntity';

describe('RefundItemEntity class', () => {
  it('should set ID', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setID('1');
    expect(refundItemEntity.getID()).toBe('1');
  });

  it('should set RefundedAt', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setRefundedAt(0);
    expect(refundItemEntity.getRefundedAt()).toBe(0);
  });

  it('should set CreatedAt', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setCreatedAt(0);
    expect(refundItemEntity.getCreatedAt()).toBe(0);
  });

  it('should set IsProcessed', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setIsProcessed('yes');
    expect(refundItemEntity.getIsProcessed()).toBe('yes');
  });

  it('should set IsException', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setIsException('true');
    expect(refundItemEntity.getIsException()).toBe('true');
  });

  it('should set RefundShipping', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setRefundShipping('test');
    expect(refundItemEntity.getRefundShipping()).toBe('test');
  });

  it('should set RefundType', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setRefundType('1');
    expect(refundItemEntity.getRefundType()).toBe('1');
  });

  it('should set PaymentMethod', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setPaymentMethod('test');
    expect(refundItemEntity.getPaymentMethod()).toBe('test');
  });

  it('should set OrderNumber', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setOrderNumber('test');
    expect(refundItemEntity.getOrderNumber()).toBe('test');
  });

  it('should set RefundID', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setRefundID('test');
    expect(refundItemEntity.getRefundID()).toBe('test');
  });

  it('should set Source', async () => {
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setSource('test');
    expect(refundItemEntity.getSource()).toBe('test');
  });

  it('should set Source', async () => {
    const refundItemEntity = new RefundItemEntity();
    const refundOrderLine = new RefundOrderLineEntity();
    refundOrderLine.setQuantity('1.00');
    refundOrderLine.setProductSku('test');
    refundOrderLine.setLineTotal('1.00');
    refundOrderLine.setData('test');
    refundOrderLine.setKeyTable('test');
    refundItemEntity.setOrderLine(refundOrderLine);

    refundItemEntity.getOrderLines().forEach(item => {
      expect(item.getQuantity()).toBe('1.00');
      expect(item.getProductSku()).toBe('test');
      expect(item.getLineTotal()).toBe('1.00');
      expect(item.getData()).toBe('test');
      expect(item.getKeyTable()).toBe('test');
    });
  });
});
