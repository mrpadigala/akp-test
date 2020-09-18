import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';

import PutItemInputAttributeMap = DocumentClient.PutItemInputAttributeMap;

export default interface IOrdersV3WorldpayNotification extends PutItemInputAttributeMap {
  OrderId: string;
  AttributeId: string;
  Status: string;
  Timestamp: number;
  RawMessage: string;
}
