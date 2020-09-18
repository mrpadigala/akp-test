// @ts-ignore
import { OMS } from 'plt-layer';
import * as csv from 'csvtojson';
import S3Client from '../../Core/client/S3Client';
import { ICarrierCSVFile, IFile } from '../index.type';
import Core from '../../Core/Core';
import OrderV3MenaHeldRepository from '../../Core/repository/OrderV3MenaHeldRepository';
import DeliveryEntity from '../entity/DeliveryEntity';
import ReportService from './ReportService';
import CustomerService from './CustomerService';
import IOrderV3 from '../../Core/interface/IOrderV3';

export default class OrderStatusService {
  private s3Client: S3Client;

  private repository: OrderV3MenaHeldRepository;

  private reportService: ReportService;

  private customerService: CustomerService;

  constructor(
    s3Client: S3Client,
    repository: OrderV3MenaHeldRepository,
    customerService: CustomerService,
    reportService: ReportService,
  ) {
    this.s3Client = s3Client;
    this.repository = repository;
    this.customerService = customerService;
    this.reportService = reportService;
  }

  public async check(file: IFile): Promise<any[]> {
    const rows = await this.getOrderData(file);
    const queries = rows.map((row) => this.process(row));
    return Promise.all(queries);
  }

  private getOrderData(file: IFile): Promise<DeliveryEntity[]> {
    return this.s3Client.download(file.filename, file.bucket).then((csvStr) => {
      Core.log('File provider name = ', this.getProviderName(file.filename));
      return csv()
        .fromString(csvStr)
        .then((items: ICarrierCSVFile[]) => {
          return items.filter((i) => this.isValidRow(i)).map((i) => {
            const deliveryEntity = new DeliveryEntity();
            deliveryEntity.setOrderNumber(i.Reference);
            deliveryEntity.setIsRTO(i['Is RTO']);
            deliveryEntity.setStatus(i['Package Status']);
            deliveryEntity.setBillingType(i['Billing Type']);

            return deliveryEntity;
          });
        });
    });
  }

  private isValidRow(row: ICarrierCSVFile): boolean {
    return row['Billing Type'] === 'COD'
    && this.isNotEmpty(row['Is RTO'])
    && this.isNotEmpty(row.Reference)
    && row['Package Status'] !== undefined;
  }

  private isNotEmpty(field): boolean {
    return field !== undefined && field !== null && field !== '';
  }

  private log(orderNumber: string, comment: string, status: string): Promise<any> {
    return OMS.Log.add(orderNumber, {
      Comment: comment,
      Type: 'Mena Order',
      User: 'OMS',
      LogData: {
        Status: status,
      },
    });
  }

  private async process(row: DeliveryEntity): Promise<any> {
    const order = await this.getFullOrderData(row.getOrderNumber());

    if (row.isReturned()) {
      return Promise.all([
        this.isValidCustomerUUID(order) ? this.customerService.addToBlacklist(order.CustomerUuid) : null,
        this.reportService.addReturned(row.getOrderNumber()),
        this.log(row.getOrderNumber(), 'Mena Order was Returned to Origin', 'MENA RTO'),
      ]);
    }

    if (row.isDelivered()) {
      return Promise.all([
        this.isValidCustomerUUID(order) ? this.customerService.addToWhitelist(order.CustomerUuid) : null,
        this.repository.updatePaidStatus(row.getOrderNumber(), true),
        this.reportService.addDelivered(row.getOrderNumber()),
        this.log(row.getOrderNumber(), 'Mena Order was paid', 'MENA DELIVERED'),
      ]);
    }

    Core.log('MENA order - unknown status', row);
    return Promise.resolve(row);
  }

  private async getFullOrderData(orderNumber: string): Promise<IOrderV3> {
    try {
      return await OMS.Order.getById(orderNumber);
    } catch (error) {
      Core.log('plt-layer problem to get order: ', orderNumber);
      throw error;
    }
  }

  private isValidCustomerUUID(order: IOrderV3): boolean {
    return order.CustomerUuid !== '0' && order.CustomerDetails.Type !== 'Guest';
  }

  private getProviderName(path: string): string {
    if (!path) return path;

    const subPaths = path.split('/');
    return subPaths[0] ? subPaths[0] : path;
  }
}
