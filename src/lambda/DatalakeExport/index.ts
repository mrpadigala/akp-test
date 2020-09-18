import Core from '../Core/Core';
import App from './App';

exports.handler = async event => {
  try {
    const app = new App(event);
    const request = app.getRequestService();
    const fileTransferService = app.getFileTransferService();
    await fileTransferService.syncS3ToGoogleStorage(request.getRecords());
  } catch (error) {
    Core.logError(event, error);
    throw error;
  }
};
