import Core from '../Core/Core';
import App from './App';

exports.handler = async event => {
  try {
    const app = new App(event);
    const request = app.getRequestService();
    const orderTransferService = app.getOrderTransferService();
    await orderTransferService.uploadAll(request.getRecords());

    return Core.responseService(200, {}).toJSON();
  } catch (error) {
    Core.logError(event, error);
    return Core.responseService(error.status ? error.status : 500, { error: error.message }).toJSON();
  }
};
