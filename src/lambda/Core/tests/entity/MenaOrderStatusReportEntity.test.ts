import MenaOrderStatusReportEntity from '../../entity/MenaOrderStatusReportEntity';
import { ReportPaymentStatus, ReportStatus } from '../../interface/IMenaOrderStatusReport';

describe('MenaOrderStatusReportEntity class', () => {
  it('should set entityID', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    expect(menaOrderStatusReportEntity.getEntityID()).toBe('mena-order');
  });

  it('should set entityType', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    menaOrderStatusReportEntity.setEntityType('status#2020-06-16-11-46#UUID');
    expect(menaOrderStatusReportEntity.getEntityType()).toBe('status#2020-06-16-11-46#UUID');
  });

  it('should set orderNumber', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    menaOrderStatusReportEntity.setOrderNumber('12312-123123-123123-123');
    expect(menaOrderStatusReportEntity.getOrderNumber()).toBe('12312-123123-123123-123');
  });

  it('should set paymentStatus', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    menaOrderStatusReportEntity.setPaymentStatus(ReportPaymentStatus.Paid);
    expect(menaOrderStatusReportEntity.getPaymentStatus()).toBe(ReportPaymentStatus.Paid);
  });

  it('should set status', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    menaOrderStatusReportEntity.setStatus(ReportStatus.Delivered);
    expect(menaOrderStatusReportEntity.getStatus()).toBe(ReportStatus.Delivered);
  });

  it('should set createdAt', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    menaOrderStatusReportEntity.setCreatedAt(1591273755047);
    expect(menaOrderStatusReportEntity.getCreatedAt()).toBe(1591273755047);
  });

  it('should set TTL', async () => {
    const menaOrderStatusReportEntity = new MenaOrderStatusReportEntity();
    menaOrderStatusReportEntity.setTTL(1622809755);
    expect(menaOrderStatusReportEntity.getTTL()).toBe(1622809755);
  });
});
