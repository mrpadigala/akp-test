export default class ResponseService {
  private readonly status: number;

  private readonly body: any;

  constructor(status: number, body: any) {
    this.status = status;
    this.body = body;
    this.logInvalidRequest();
  }

  public toJSON(): any {
    return {
      statusCode: this.status,
      body: JSON.stringify(this.body),
      isBase64Encoded: false,
    };
  }

  private logInvalidRequest(): void {
    if (this.status !== 200) {
      console.log(this.status, 'invalid request', JSON.stringify(this.body));
    }
  }
}
