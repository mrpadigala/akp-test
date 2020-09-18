// @ts-ignore
import { OMS } from 'plt-layer';
import * as uuidv4 from 'uuid/v4';
import OrderV3MenaHeldRepository from '../../Core/repository/OrderV3MenaHeldRepository';
import { IEventBody } from '../index.type';
import RefundRepository from '../../Core/repository/RefundRepository';
import RefundItemEntity from '../../Core/entity/RefundItemEntity';
import RefundOrderLineEntity from '../../Core/entity/RefundOrderLineEntity';
import WmsService from './WmsService';
import SageService from './SageService';
import ReportService from './ReportService';
import RequestService from './RequestService';

export default class HeldOrdersService {
  private refundRepository: RefundRepository;

  private orderV3MenaHeldRepository: OrderV3MenaHeldRepository;

  private wmsService: WmsService;

  private sageService: SageService;

  private reportService: ReportService;

  constructor(
    orderV3MenaHeldRepository: OrderV3MenaHeldRepository,
    refundRepository: RefundRepository,
    wmsService: WmsService,
    sageService: SageService,
    reportService: ReportService,
  ) {
    this.orderV3MenaHeldRepository = orderV3MenaHeldRepository;
    this.refundRepository = refundRepository;
    this.wmsService = wmsService;
    this.sageService = sageService;
    this.reportService = reportService;
  }

  public async confirm(request: RequestService): Promise<any[]> {
    console.log('Start confirmation', request.getOrderId());
    return Promise.all([
      this.updateOrder(request.getOrderId(), request.getData()),
      this.publishOrderToWms(request.getOrderId()),
      this.setActivityLog(request.getOrderId(), 'Order approved', request.getUsername()),
      this.removeHeldOrderEntity(request.getOrderId()),
    ]);
  }

  public async cancel(request: RequestService): Promise<any[]> {
    const order = await OMS.Order.getById(request.getOrderId());
    return Promise.all([
      this.refundOrder(order),
      this.publishCancelledOrderToSage(order),
      this.setActivityLog(request.getOrderId(), 'Order cancelled', request.getUsername()),
      this.removeHeldOrderEntity(request.getOrderId()),
      this.reportService.addCancelled(request.getOrderId()),
    ]);
  }

  private async updateOrder(orderId, data): Promise<any> {
    return OMS.Order.updateOrder(orderId, this.buildOrderUpdateObject(data));
  }

  private async removeHeldOrderEntity(orderId: string): Promise<any> {
    return this.orderV3MenaHeldRepository.menaRemoveHeldOrder(orderId);
  }

  private async refundOrder(order): Promise<any> {
    return this.refundRepository.refundOrder(this.buildRefundItemEntity(order));
  }

  private async setActivityLog(orderId, message, username: string): Promise<any> {
    console.log('Add activity log', orderId, message);
    return OMS.Log.add(orderId, {
      Comment: message,
      Type: 'Mena Order',
      User: username,
      LogData: {},
    });
  }

  private async publishOrderToWms(orderId): Promise<any> {
    const order = await OMS.Order.getById(orderId);
    return this.wmsService.publishOrder(order);
  }

  private async publishCancelledOrderToSage(order): Promise<any> {
    return this.sageService.publishCancelledOrder(order);
  }

  private buildRefundItemEntity(order): RefundItemEntity {
    const oid = `OID-${order.OrderNumber}-${Math.floor(Math.random() * 99)}`;
    const refundItemEntity = new RefundItemEntity();
    refundItemEntity.setID(uuidv4());
    refundItemEntity.setRefundID(oid);
    refundItemEntity.setOrderNumber(order.OrderNumber);
    refundItemEntity.setPaymentMethod(order.PaymentDetails.Method);
    refundItemEntity.setRefundType('1');
    refundItemEntity.setRefundedAt(0);
    refundItemEntity.setRefundShipping('Yes');
    refundItemEntity.setIsException('false');
    refundItemEntity.setIsProcessed('Pending');
    refundItemEntity.setSource('OMS_Interface');
    refundItemEntity.setCreatedAt(new Date().getTime());

    order.Items.forEach(item => {
      const refundOrderLineEntity = new RefundOrderLineEntity();
      refundOrderLineEntity.setData(oid);
      refundOrderLineEntity.setLineTotal(this.calculateLineTotal(item).toFixed(5));
      refundOrderLineEntity.setProductSku(item.Sku);
      refundOrderLineEntity.setQuantity(parseFloat(item.Quantity).toFixed(5));
      refundItemEntity.setOrderLine(refundOrderLineEntity);
    });

    return refundItemEntity;
  }

  private calculateLineTotal(item): Number {
    const total = (typeof item.RowTotalActual === 'undefined')
      ? (item.RowTotalInclTax - item.Discount) : item.RowTotalActual;

    return parseFloat(total);
  }

  private buildOrderUpdateObject(data: IEventBody): Object {
    const notMandatoryFields = [
      { dbKey: 'CustomerDetails.PassportId', valueKey: 'passportId' },
      { dbKey: 'ShippingDetails.Additional.BuildingName', valueKey: 'buildingName' },
      { dbKey: 'ShippingDetails.Additional.AddressDetails', valueKey: 'addressDetail' },
      { dbKey: 'ShippingDetails.Additional.AlternateTelephone', valueKey: 'alternatePhone' },
      { dbKey: 'ShippingDetails.Additional.District', valueKey: 'districtName' },
      { dbKey: 'ShippingDetails.Additional.Geo.Lat', valueKey: 'latitude' },
      { dbKey: 'ShippingDetails.Additional.Geo.Lng', valueKey: 'longitude' },
      { dbKey: 'ShippingDetails.Additional.Landmark', valueKey: 'nearestLandmark' },
      { dbKey: 'ShippingDetails.Address.Region', valueKey: 'region' },
    ];
    const updateFields = {
      'CustomerDetails.Phone': data.phone,
      'ShippingDetails.Address.City': data.city,
      'ShippingDetails.Address.Country': data.country,
      'ShippingDetails.Address.Postcode': data.postcode,
      'ShippingDetails.Address.Street': data.streetName,
      'ShippingDetails.Address.CountryCode': data.country,
    };

    notMandatoryFields.forEach(field => {
      if (data[field.valueKey]) {
        updateFields[field.dbKey] = data[field.valueKey];
      }
    });

    return updateFields;
  }
}
