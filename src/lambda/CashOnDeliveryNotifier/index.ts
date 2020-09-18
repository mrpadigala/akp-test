import App from './App';
import Core from '../Core/Core';
import { IEvent } from './index.type';

exports.handler = async (event: IEvent) => {
  try {
    const app = new App(event);
    const requestService = app.getRequestService();
    const orderStatusService = app.getOrderStatusService();
    await orderStatusService.check(requestService.getFile());
  } catch (error) {
    Core.logError(error.message, error);
  }
};
