import { IEnv } from './index.type';
import SsmClient from '../Core/client/SsmClient';

export default class Config {
  private readonly env: IEnv;

  private readonly ssmClient: SsmClient;

  constructor(env, ssmClient: SsmClient) {
    this.env = env;
    this.ssmClient = ssmClient;
  }

  public getCarrierFtpHost(): string {
    return this.env.CARRIER_FTP_HOST;
  }

  public getCarrierFtpUser(): string {
    return this.env.CARRIER_FTP_USER;
  }

  public getCarrierFtpPath(): string {
    return this.env.CARRIER_FTP_PATH;
  }

  public async getCarrierFtpPassword(): Promise<string> {
    return this.ssmClient.get(this.env.CARRIER_FTP_PASSWORD_SSM_PARAM_NAME);
  }

  public isCarrierSecureConnection(): boolean {
    return this.env.CARRIER_FTP_SECURE_CONNECTION === 'true';
  }

  public getCarrierS3Bucket(): string {
    return this.env.CARRIER_S3_SYNC_BUCKET;
  }

  public getCarrierS3Path(): string {
    return this.env.CARRIER_S3_SYNC_PATH;
  }

  public getCustomerInformationApiEndpoint(): string {
    return this.env.CUSTOMER_INFORMATION_API_ENDPOINT;
  }

  public getCustomerInformationApiKeySsmName(): string {
    return this.env.CUSTOMER_INFORMATION_API_KEY_SSM_PARAM_NAME;
  }
}
