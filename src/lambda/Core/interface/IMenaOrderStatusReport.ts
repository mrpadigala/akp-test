import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';

import PutItemInputAttributeMap = DocumentClient.PutItemInputAttributeMap;

export enum ReportPaymentStatus {
  Unpaid = 'Unpaid',
  Paid = 'Paid',
}

export enum ReportStatus {
  Cancelled = 'Cancelled',
  Returned = 'Returned',
  Delivered = 'Delivered',
}

export default interface IMenaOrderStatusReport extends PutItemInputAttributeMap {
  EntityId: string;
  EntityType: string;
  Data: {
    OrderNumber: string;
    PaymentStatus: ReportPaymentStatus;
    Status: ReportStatus;
  }
  CreatedAt: number;
  TTL: number;
}
