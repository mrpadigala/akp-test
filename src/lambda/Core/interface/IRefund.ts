import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';

import PutItemInputAttributeMap = DocumentClient.PutItemInputAttributeMap;

export default interface IRefund extends PutItemInputAttributeMap {
  Id: string;
  RefundId: string;
  OrderNumber: string;
  PaymentMethod: string;
  RefundType: string;
  RefundShipping: string;
  Source: string;
  OrderLines: IRefundLine[];
  IsException: string;
  IsProcessed: string;
  CreatedAt: number;
  RefundedAt: number;
}

interface IRefundLine {
  Data: string;
  KeyTable: string;
  LineTotal: string;
  ProductSku: string;
  Quantity: string;
}
