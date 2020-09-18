import Core from '../Core/Core';
import App from './App';

exports.handler = async event => {
  try {
    const app = new App(event);
    const request = app.getRequestService();
    const heldOrdersService = app.getHeldOrdersService();
    const contactAttemptService = app.getContactAttemptService();

    // eslint-disable-next-line default-case
    switch (request.getAction()) {
      case 'confirmation':
        await heldOrdersService.confirm(request);
        break;
      case 'cancellation':
        await heldOrdersService.cancel(request);
        break;
      case 'contact-attempt':
        await contactAttemptService.contact(request);
        break;
    }

    return Core.responseService(200, { Status: 'Success' }).toJSON();
  } catch (error) {
    Core.logError(event, error);
    return Core.responseService(
      error.status ? error.status : 500,
      { error: error.message },
    ).toJSON();
  }
};
