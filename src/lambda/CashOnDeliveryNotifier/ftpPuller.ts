import App from './App';
import Core from '../Core/Core';

exports.handler = async () => {
  try {
    const app = new App();
    const fileTransferService = app.getFileTransferService();
    await fileTransferService.syncFtpToS3();
  } catch (error) {
    Core.logError(error.message, error);
  }
};
