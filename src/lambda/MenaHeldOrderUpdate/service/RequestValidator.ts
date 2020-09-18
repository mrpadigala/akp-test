import ValidationError from '../error/ValidationError';

export default class RequestValidator {
  private static readonly CONFIRMATION = 'confirmation';

  private static readonly CANCELLATION = 'cancellation';

  private static readonly CONTACT_ATTEMPT = 'contact-attempt';

  private actions: (string)[] = [
    RequestValidator.CONFIRMATION,
    RequestValidator.CANCELLATION,
    RequestValidator.CONTACT_ATTEMPT,
  ];

  private static readonly rules = {
    confirmation: [
      { name: 'orderId', required: true },
      { name: 'region', required: false },
      { name: 'country', required: true },
      { name: 'buildingName', required: false },
      { name: 'streetName', required: true },
      { name: 'city', required: true },
      { name: 'districtName', required: false },
      { name: 'longitude', required: false },
      { name: 'latitude', required: false },
      { name: 'addressDetail', required: false },
      { name: 'nearestLandmark', required: false },
      { name: 'postcode', required: true },
      { name: 'passportId', required: false },
      { name: 'phone', required: true },
      { name: 'alternatePhone', required: false },
      { name: 'username', required: true },
    ],
    cancellation: [
      { name: 'orderId', required: true },
      { name: 'username', required: true },
    ],
    'contact-attempt': [
      { name: 'orderId', required: true },
      { name: 'username', required: true },
    ],
  };

  public validate(request: any) {
    if (!request.action || !this.actions.includes(request.action)) {
      throw new Error('Action is missing');
    }

    RequestValidator.rules[request.action].forEach(field => {
      if (field.required && !request[field.name]) {
        throw new ValidationError(`${field.name} is missing - Unprocessable entity`);
      }
    });
  }
}
