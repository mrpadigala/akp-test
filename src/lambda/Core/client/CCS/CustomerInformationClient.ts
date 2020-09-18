import axios from 'axios';
import Core from '../../Core';
import CustomerInformationConfig from './CustomerInformationConfig';

export default class CustomerInformationClient {
  private config: CustomerInformationConfig;

  constructor(config: CustomerInformationConfig) {
    this.config = config;
  }

  public async setCashOnDeliveryApproved(customerUUID: string, value: boolean): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const body = {
        Item: {
          CashOnDeliveryApproved: value,
        },
      };
      return axios
        .post(`${this.config.getApiEndpoint()}/${customerUUID}/`, body, {
          headers: {
            'x-api-key': await this.config.getApiKey(),
          },
          timeout: 10000,
        })
        .then((resp) => resolve(resp.data))
        .catch((err) => {
          Core.log('CCS API call failed', 'Order: ', customerUUID);
          reject(err);
        });
    });
  }
}
