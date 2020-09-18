import Core from '../Core/Core';
import App from './App';

exports.handler = async event => {
  try {
    const app = new App(event);
    const request = app.getRequestService();
    const heldOrdersService = app.getHeldOrdersService();
    const data = await heldOrdersService.list(request.getPage());

    return Core.responseService(200, data).toJSON();
  } catch (error) {
    Core.logError(event, error);
    return Core.responseService(error.status ? error.status : 500, { error: error.message }).toJSON();
  }
};
