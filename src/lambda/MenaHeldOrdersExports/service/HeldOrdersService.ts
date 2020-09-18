// @ts-ignore
import { OMS } from 'plt-layer';
import OrderV3MenaHoldRepository from '../../Core/repository/OrderV3MenaHeldRepository';
import IOrderV3 from '../../Core/interface/IOrderV3';

export default class HeldOrdersService {
  private repository: OrderV3MenaHoldRepository;

  constructor(repository: OrderV3MenaHoldRepository) {
    this.repository = repository;
  }

  public async list(page: string = null): Promise<{ orders: any[]; pageToken: string }> {
    const data = await this.repository.menaHeldOrdersList(page);
    const items = data.items.map(item => OMS.Order.getById(item.getOrderId()));
    const orders = await Promise.all(items);

    return {
      orders: this.groups(orders),
      pageToken: data.LastEvaluatedKey,
    };
  }

  private groups(orders: IOrderV3[]): any {
    const sku = {};
    orders.forEach(order => {
      order.Items.forEach(line => {
        if (!sku[line.Sku]) {
          sku[line.Sku] = { qty: 0 };
        }
        sku[line.Sku].qty += parseInt(line.Quantity, 10);
      });
    });

    return sku;
  }
}
