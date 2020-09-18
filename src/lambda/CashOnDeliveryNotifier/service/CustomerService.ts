import CustomerInformationClient from '../../Core/client/CCS/CustomerInformationClient';

export default class CustomerService {
  private customerInformationClient;

  constructor(customerInformationClient: CustomerInformationClient) {
    this.customerInformationClient = customerInformationClient;
  }

  public addToWhitelist(customerId: string) {
    return this.customerInformationClient.setCashOnDeliveryApproved(customerId, true);
  }

  public addToBlacklist(customerId: string) {
    return this.customerInformationClient.setCashOnDeliveryApproved(customerId, false);
  }
}
