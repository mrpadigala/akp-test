import * as AWS from 'aws-sdk';
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';
import * as moduleAlias from 'module-alias';
import * as moment from 'moment-timezone';
import OrderV3MenaHeldRepository from './repository/OrderV3MenaHeldRepository';
import ResponseService from './service/ResponseService';
import RefundRepository from './repository/RefundRepository';
import SsmClient from './client/SsmClient';
import S3Client from './client/S3Client';
import ReportMenaOrderRepository from './repository/ReportMenaOrderRepository';
import CustomerInformationClient from './client/CCS/CustomerInformationClient';
import CustomerInformationConfig from './client/CCS/CustomerInformationConfig';
import Config from './Config';
import SqsClient from './client/SqsClient';
import OrderV3NotificationRepository from './repository/OrderV3NotificationRepository';

export default class Core {
  private static docClient: DocumentClient;

  private static cachedSsmClient = null;

  static parseEventBody<T>(event): T {
    if (!event.body) {
      throw new Error('body is missing - Unprocessable entity');
    }
    return typeof event.body === 'object' ? event.body : JSON.parse(event.body);
  }

  static parseEventQuery<T>(event): T {
    return event.queryStringParameters;
  }

  static log(...data): void {
    console.log(data);
  }

  static logError(event, error): void {
    console.error(JSON.stringify(event), JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }

  static responseService(status: number, body: any): ResponseService {
    return new ResponseService(status, body);
  }

  static isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development'
      && process.env.DYNAMODB_ENDPOINT !== undefined
      && process.env.S3_ENDPOINT !== undefined;
  }

  constructor() {
    Core.docClient = null;
  }

  public getOrdersV3Repository(): OrderV3MenaHeldRepository {
    return new OrderV3MenaHeldRepository(Core.getDB());
  }

  static getOrderV3NotificationRepository(): OrderV3NotificationRepository {
    return new OrderV3NotificationRepository(Core.getDB());
  }

  public getRefundRepository(): RefundRepository {
    return new RefundRepository(Core.getDB());
  }

  public getReportMenaOrderRepository(): ReportMenaOrderRepository {
    return new ReportMenaOrderRepository(Core.getDB());
  }

  static getS3Client(): S3Client {
    return new S3Client(Core.getS3());
  }

  static getS3() {
    if (Core.isDevelopmentMode()) {
      return new AWS.S3({
        s3ForcePathStyle: true,
        accessKeyId: 'S3RVER',
        secretAccessKey: 'S3RVER',
        endpoint: Core.getConfig().get('S3_ENDPOINT'),
      });
    }
    return new AWS.S3();
  }

  private static getDB() {
    if (Core.docClient === null) {
      const options = {
        apiVersion: '2013-12-02',
        convertEmptyValues: true,
      };
      if (Core.isDevelopmentMode()) {
        // @ts-ignore
        options.endpoint = Core.getConfig().get('DYNAMODB_ENDPOINT');
      }
      Core.docClient = new AWS.DynamoDB.DocumentClient(options);
    }

    return Core.docClient;
  }

  static getSsmClient(): SsmClient {
    if (Core.cachedSsmClient === null) {
      Core.cachedSsmClient = new SsmClient(new AWS.SSM());
    }
    return Core.cachedSsmClient;
  }

  public getCustomerInformationClient(endpoint, keyName) {
    const config = new CustomerInformationConfig(endpoint, keyName, Core.getSsmClient());
    return new CustomerInformationClient(config);
  }

  static getConfig(): Config {
    return new Config(process.env);
  }

  static getSqs() {
    if (Core.isDevelopmentMode()) {
      return new AWS.SQS({
        endpoint: Core.getConfig().get('SQS_ENDPOINT'),
        apiVersion: '2012-11-05',
        region: 'us-east-1',
      });
    }
    return new AWS.SQS();
  }

  static getSqsClient() {
    return new SqsClient(this.getSqs());
  }

  static getSns() {
    if (Core.isDevelopmentMode()) {
      return new AWS.SNS({
        endpoint: Core.getConfig().get('SNS_ENDPOINT'),
        region: 'us-east-1',
      });
    }
    return new AWS.SNS();
  }

  static getMoment(defaultDate = {}, format = '') {
    moment.tz.setDefault('Europe/London');
    return moment(defaultDate, format);
  }
}

if (Core.isDevelopmentMode()) {
  moduleAlias.addAlias('plt-layer', `${__dirname}/../../serverless/plt-layer/index`);
}
