import * as AWS from 'aws-sdk';
import S3Client from '../../Core/client/S3Client';
import Config from '../../Core/Config';
import { IRecord } from '../index.type';
import Core from '../../Core/Core';

export default class OrderTransferService {
  private s3Client: S3Client;

  private config: Config;

  constructor(s3Client: S3Client, config: Config) {
    this.s3Client = s3Client;
    this.config = config;
  }

  public uploadAll(items: IRecord[]): Promise<void[]> {
    const queries = items.map((record) => {
      const preparedOrder = this.prepareOrder(record);
      const filename = this.getFileName(record);
      return this.uploadOne(filename, preparedOrder);
    });

    return Promise.all(queries);
  }

  private getFileName(record: IRecord): string {
    const now = Core.getMoment().format('X');
    const path = this.config.get('S3_PATH_TO_ORDERS');

    let order = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    let deleteFlag = '';

    if (record.eventName === 'REMOVE') {
      deleteFlag = '-deleted';
      order = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
    }
    const attributeId = order.AttributeId.replace(/\//g, '-');

    return `${path}/${order.OrderId}/${now}_${attributeId}${deleteFlag}.json`;
  }

  private uploadOne(filename: string, order: any): Promise<void> {
    const bucket = this.config.get('S3_BUCKET_ORDER_STREAM_PROCESSOR');
    return this.s3Client.upload(JSON.stringify(order), filename, bucket);
  }

  private prepareOrder(record: IRecord) {
    let order = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    if (record.eventName === 'REMOVE') {
      order = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
    }

    if (order.AttributeId === 'Details') {
      order.IndexOrderNumber = order.OrderNumber;
    }

    const disallowFields = [
      'IndexCustomerId',
      'IndexEmail',
      'IndexOrderCreateDate',
      'IndexPostcodeLastName',
    ];
    disallowFields.forEach(property => {
      delete order[property];
    });

    return order;
  }
}
