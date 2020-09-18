import Core from '../Core/Core';
import App from './App';

exports.handler = async (event) => {
  try {
    const app = new App(event);
    const request = app.getRequestService();
    const worldpayNotificationsService = app.getWorldpayNotificationsService();
    await worldpayNotificationsService.save(request);
  } catch (error) {
    Core.logError(event, error);
    throw error;
  }
};
