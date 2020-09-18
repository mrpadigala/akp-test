import OrderV3NotificationRepository from '../../Core/repository/OrderV3NotificationRepository';
import WorldpayNotificationEntity from '../../Core/entity/WorldpayNotificationEntity';
import RequestService from './RequestService';
import Core from '../../Core/Core';

export default class WorldpayNotificationsService {
  private repository: OrderV3NotificationRepository;

  constructor(repository: OrderV3NotificationRepository) {
    this.repository = repository;
  }

  public save(request: RequestService) {
    const timestampMs = Core.getMoment().format('x');
    const entity = new WorldpayNotificationEntity();
    entity.setOrderId(request.getOrderId());
    entity.setAttributeId(`Notification#Worldpay#${timestampMs}`);
    entity.setStatus(request.getStatus());
    entity.setTimestamp(Number(timestampMs));
    entity.setRawMessage(request.getRawMessage());

    return this.repository.create(entity);
  }
}
