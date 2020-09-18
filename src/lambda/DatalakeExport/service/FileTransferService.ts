import { Storage } from '@google-cloud/storage';
import S3Client from '../../Core/client/S3Client';
import Config from '../../Core/Config';
import { IEventRecord } from '../index.type';

export default class FileTransferService {
  private s3Client: S3Client;

  private config: Config;

  private googleStorage;

  constructor(s3Client: S3Client, config: Config) {
    this.s3Client = s3Client;
    this.config = config;
  }

  public async syncS3ToGoogleStorage(records: IEventRecord[]): Promise<any[]> {
    this.googleStorage = new Storage({
      projectId: this.config.get('GOOGLE_CLOUD_PROJECT_ID'),
      credentials: {
        client_email: this.config.get('GOOGLE_CLOUD_CLIENT_EMAIL'),
        private_key: await this.config.getBySsm('GOOGLE_CLOUD_SSM_PRIVATE_KEY'),
      },
    });

    const requests = [];
    for (const record of records) {
      requests.push(this.processRecord(record));
    }

    return Promise.all(requests);
  }

  private async processRecord(record: IEventRecord) {
    const filename = decodeURIComponent(record.s3.object.key);
    const bucket = record.s3.bucket.name;
    const s3FileBody = await this.s3Client.download(filename, bucket);
    return this.uploadToGoogleStorage(s3FileBody, filename);
  }

  private async uploadToGoogleStorage(body, filename): Promise<void> {
    const googleBucket = await this.googleStorage.bucket(this.config.get('GOOGLE_CLOUD_BUCKET'));
    const path = this.config.get('GOOGLE_CLOUD_PATH');
    return googleBucket.file(`${path}/${filename}`).save(body);
  }
}
