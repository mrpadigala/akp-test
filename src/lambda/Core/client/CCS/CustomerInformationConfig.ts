import SsmClient from '../SsmClient';

export default class CustomerInformationConfig {
  private readonly endpoint;

  private readonly ssmNameKey;

  private ssmClient;

  constructor(endpoint: string, ssmNameKey: string, ssmClient: SsmClient) {
    this.endpoint = endpoint;
    this.ssmNameKey = ssmNameKey;
    this.ssmClient = ssmClient;
  }

  public getApiEndpoint(): string {
    return this.endpoint;
  }

  public getApiKey(): Promise<string> {
    return this.ssmClient.get(this.ssmNameKey);
  }
}
