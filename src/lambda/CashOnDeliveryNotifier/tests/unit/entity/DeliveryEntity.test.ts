import DeliveryEntity from '../../../entity/DeliveryEntity';

describe('DeliveryEntity class', () => {
  it('should set OrderNumber', async () => {
    const deliveryEntity = new DeliveryEntity();
    deliveryEntity.setOrderNumber('123-123213-1233434-234');
    expect(deliveryEntity.getOrderNumber()).toBe('123-123213-1233434-234');
  });

  it('should set status', async () => {
    const deliveryEntity = new DeliveryEntity();
    deliveryEntity.setStatus('delivered');
    expect(deliveryEntity.getStatus()).toBe('delivered');
  });

  it('should set isRTO', async () => {
    const deliveryEntity = new DeliveryEntity();
    deliveryEntity.setIsRTO('TRUE');
    expect(deliveryEntity.getIsRTO()).toBe(true);

    deliveryEntity.setIsRTO('FALSE');
    expect(deliveryEntity.getIsRTO()).toBe(false);

    deliveryEntity.setIsRTO('true');
    expect(deliveryEntity.getIsRTO()).toBe(true);

    deliveryEntity.setIsRTO('qwerty');
    expect(deliveryEntity.getIsRTO()).toBe(false);
  });

  it('should return isReturned', async () => {
    const deliveryEntity = new DeliveryEntity();
    deliveryEntity.setIsRTO('TRUE');
    expect(deliveryEntity.isReturned()).toBe(true);
  });

  it('should return isDelivered', async () => {
    const deliveryEntity = new DeliveryEntity();
    deliveryEntity.setIsRTO('TRUE');
    deliveryEntity.setStatus('DELIVERED');
    expect(deliveryEntity.isDelivered()).toBe(false);

    deliveryEntity.setIsRTO('FALSE');
    expect(deliveryEntity.isDelivered()).toBe(true);

    deliveryEntity.setStatus('');
    expect(deliveryEntity.isDelivered()).toBe(false);
  });
});
