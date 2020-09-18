// @ts-ignore
import { OMS } from 'plt-layer';
import OrderV3MenaHoldRepository from '../../Core/repository/OrderV3MenaHeldRepository';
import IOrderV3Layer from '../../Core/interface/IOrderV3Layer';

export default class HeldOrdersService {
  private repository: OrderV3MenaHoldRepository;

  constructor(repository: OrderV3MenaHoldRepository) {
    this.repository = repository;
  }

  public async list(page: string = null): Promise<{ orders: any[]; pageToken: string }> {
    const data = await this.repository.menaHeldOrdersList(page, 50);
    const items = data.items.map(item => OMS.Order.getById(item.getOrderId()));
    const orders = await Promise.all(items);
    const filtered = orders.map(order => this.filter(order));

    return {
      orders: filtered,
      pageToken: data.LastEvaluatedKey,
    };
  }

  private filter(order: IOrderV3Layer) {
    return {
      orderNumber: order.OrderId,
      email: order.CustomerDetails.Email,
      orderDate: order.OrderDate,
      orderTotal: order.BaseOrderTotal,
      storeCredit: order.PaymentDetails.StoreCredit ? order.PaymentDetails.StoreCredit : 0,
      items: order.Items.map(i => ({
        sku: i.Sku,
        name: i.Name,
        quantity: i.Quantity,
        size: i.Size,
      })),
      billing: order.BillingDetails,
      shipping: order.ShippingDetails,
      details: order.OrderTotalDetails,
      reasonTypes: order.MenaHeldReasons,
      contactAttempts: order.MenaHeldContactAttempts,
    };
  }
}
