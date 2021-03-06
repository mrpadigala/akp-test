import * as moment from 'moment-timezone';
import * as uuidv4 from 'uuid/v4';
import { ReportPaymentStatus, ReportStatus } from '../../Core/interface/IMenaOrderStatusReport';
import ReportMenaOrderRepository from '../../Core/repository/ReportMenaOrderRepository';
import MenaOrderStatusReportEntity from '../../Core/entity/MenaOrderStatusReportEntity';

export default class ReportService {
  private repository: ReportMenaOrderRepository;

  constructor(repository: ReportMenaOrderRepository) {
    this.repository = repository;
  }

  public addCancelled(orderNumber: string): Promise<any> {
    const now = moment().tz('Europe/London');
    const menaOrderStatusReport = new MenaOrderStatusReportEntity();
    menaOrderStatusReport.setEntityType(`status#${now.format('YYYY-MM-DD-HH-mm')}#${uuidv4()}`);
    menaOrderStatusReport.setOrderNumber(orderNumber);
    const createdAt = parseInt(now.format('X'), 10);
    menaOrderStatusReport.setCreatedAt(createdAt);
    const ttl = parseInt(now.clone().add(3, 'months').format('x'), 10);
    menaOrderStatusReport.setTTL(ttl);
    menaOrderStatusReport.setPaymentStatus(ReportPaymentStatus.Unpaid);
    menaOrderStatusReport.setStatus(ReportStatus.Cancelled);
    return this.repository.createStatus(menaOrderStatusReport);
  }
}
