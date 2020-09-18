import { S3 } from 'aws-sdk';
import Core from '../Core';

export default class S3Client {
  private s3: S3;

  constructor(s3: S3) {
    this.s3 = s3;
  }

  public upload(data, filename, bucket): Promise<void> {
    const response = this.s3
      .putObject({
        Bucket: bucket,
        Key: filename,
        Body: data,
      })
      .promise();

    return response
      .then(() => Core.log(`S3: ${filename} file uploaded`))
      .catch((error) => {
        Core.log(`S3 problem upload file: "${filename}" to bucket: "${bucket}"`);
        Core.logError('S3 upload failed', error);
        throw error;
      });
  }

  public download(filename, bucket): Promise<string> {
    const response = this.s3
      .getObject({
        Bucket: bucket,
        Key: filename,
      })
      .promise();

    return response
      .then((data) => {
        Core.log(`S3: ${filename} file downloaded`);
        return data.Body.toString();
      })
      .catch((error) => {
        Core.log(`S3 problem download file: "${filename}" from bucket: "${bucket}"`);
        Core.logError('S3 download failed', error);
        throw error;
      });
  }
}
