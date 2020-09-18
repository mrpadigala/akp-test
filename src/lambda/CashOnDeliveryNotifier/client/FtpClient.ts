import { Client as BasicFtp, FileInfo, FTPResponse } from 'basic-ftp';
import Config from '../Config';
import WritableStream from '../helper/WritableStream';
import Core from '../../Core/Core';

export default class FtpClient {
  private ftp: BasicFtp;

  private config: Config;

  constructor(basicFtp: BasicFtp, config: Config) {
    this.ftp = basicFtp;
    this.config = config;
  }

  public async connect(): Promise<FTPResponse> {
    return this.ftp.access({
      host: this.config.getCarrierFtpHost(),
      user: this.config.getCarrierFtpUser(),
      password: await this.config.getCarrierFtpPassword(),
      secure: this.config.isCarrierSecureConnection(),
    });
  }

  public disconnect(): void {
    this.ftp.close();
  }

  public async download(fileNameWithPath): Promise<string> {
    try {
      const stream = new WritableStream();
      await this.ftp.downloadTo(stream, fileNameWithPath);
      Core.log('FTP download success. File: ', fileNameWithPath);
      return stream.getData();
    } catch (error) {
      Core.log(`FTP problem download file: "${fileNameWithPath}"`);
      throw error;
    }
  }

  public async list(path): Promise<FileInfo[]> {
    try {
      const response = await this.ftp.list(path);
      Core.log('FTP get list of files success. Path: ', path);
      return response;
    } catch (error) {
      Core.log(`FTP problem get list of files: "${path}"`);
      throw error;
    }
  }

  public async remove(path): Promise<FTPResponse> {
    try {
      const response = await this.ftp.remove(path);
      Core.log('FTP remove success. File: ', path);
      return response;
    } catch (error) {
      Core.log(`FTP problem remove file: "${path}"`);
      throw error;
    }
  }
}
