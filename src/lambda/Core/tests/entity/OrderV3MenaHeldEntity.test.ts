import OrderV3MenaHeldEntity from '../../entity/OrderV3MenaHeldEntity';

describe('OrderV3MenaHeldEntity class', () => {
  it('should set OrderId', async () => {
    const orderV3MenaHeldEntity = new OrderV3MenaHeldEntity();
    orderV3MenaHeldEntity.setOrderId('123-123213-1233434-234');
    expect(orderV3MenaHeldEntity.getOrderId()).toBe('123-123213-1233434-234');
  });

  it('should set AttributeId', async () => {
    const orderV3MenaHeldEntity = new OrderV3MenaHeldEntity();
    orderV3MenaHeldEntity.setAttributeId('MENA#Held');
    expect(orderV3MenaHeldEntity.getAttributeId()).toBe('MENA#Held');
  });

  it('should set CreatedAt', async () => {
    const orderV3MenaHeldEntity = new OrderV3MenaHeldEntity();
    orderV3MenaHeldEntity.setCreatedAt('019-07-02T09:34:48.130Z');
    expect(orderV3MenaHeldEntity.getCreatedAt()).toBe('019-07-02T09:34:48.130Z');
  });

  it('should set reason', async () => {
    const orderV3MenaHeldEntity = new OrderV3MenaHeldEntity();
    orderV3MenaHeldEntity.setReason('reason');
    expect(orderV3MenaHeldEntity.getReason()).toBe('reason');
  });
});
