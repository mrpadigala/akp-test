import * as moment from 'moment';
import FtpClient from '../client/FtpClient';
import S3Client from '../../Core/client/S3Client';
import Config from '../Config';

export default class FileTransferService {
  private ftpClient: FtpClient;

  private s3Client: S3Client;

  private config: Config;

  constructor(ftpClient: FtpClient, s3Client: S3Client, config: Config) {
    this.ftpClient = ftpClient;
    this.s3Client = s3Client;
    this.config = config;
  }

  public async syncFtpToS3() {
    try {
      await this.ftpClient.connect();
      const path = this.config.getCarrierFtpPath();
      const files = await this.ftpClient.list(path);

      for (const file of files) {
        const fullOriginPath = `${path}/${file.name}`;
        const fileBody = await this.ftpClient.download(fullOriginPath);

        const fullDestinationPath = this.getS3FullDestinationPath(file.name);
        await this.s3Client.upload(fileBody, fullDestinationPath, this.config.getCarrierS3Bucket());

        await this.ftpClient.remove(fullOriginPath);
      }

      this.ftpClient.disconnect();
    } catch (error) {
      this.ftpClient.disconnect();
      throw error;
    }
  }

  private getS3FullDestinationPath(fileName: string): string {
    const now = moment();
    let cleanFileName = fileName.replace('.csv', '');
    cleanFileName = cleanFileName.replace(' ', '_');
    cleanFileName = cleanFileName.replace(/[^0-9a-zA-Z-_]/g, '');
    const file = `${cleanFileName}${now.format('x')}.csv`;
    return `${this.config.getCarrierS3Path()}${now.format('YYYY-MM')}/${file}`;
  }
}
