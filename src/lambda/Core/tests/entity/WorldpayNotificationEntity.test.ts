import WorldpayNotificationEntity from '../../entity/WorldpayNotificationEntity';

describe('WorldpayNotificationEntity class', () => {
  it('should set Order ID', async () => {
    const entity = new WorldpayNotificationEntity();
    entity.setOrderId('12321-123123-123123');
    expect(entity.getOrderId()).toBe('12321-123123-123123');
  });

  it('should set Attribute ID', async () => {
    const entity = new WorldpayNotificationEntity();
    entity.setAttributeId('Notification#Worldpay#2312312312');
    expect(entity.getAttributeId()).toBe('Notification#Worldpay#2312312312');
  });

  it('should set Status', async () => {
    const entity = new WorldpayNotificationEntity();
    entity.setStatus('AUTHORISED');
    expect(entity.getStatus()).toBe('AUTHORISED');
  });

  it('should set Timestamp', async () => {
    const entity = new WorldpayNotificationEntity();
    entity.setTimestamp(2312312312);
    expect(entity.getTimestamp()).toBe(2312312312);
  });

  it('should set Attribute ID', async () => {
    const entity = new WorldpayNotificationEntity();
    entity.setRawMessage('<qwerty></qwerty>');
    expect(entity.getRawMessage()).toBe('<qwerty></qwerty>');
  });
});
