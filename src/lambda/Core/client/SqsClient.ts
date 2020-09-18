import * as SQS from 'aws-sdk/clients/sqs';
import Core from '../Core';

export default class SqsClient {
  private sqs: SQS;

  constructor(sqs: SQS) {
    this.sqs = sqs;
  }

  public sendMessage(queueUrl: string, message: any): Promise<SQS.Types.SendMessageResult> {
    const params = {
      MessageBody: JSON.stringify(message),
      QueueUrl: queueUrl,
    };

    return this.sqs
      .sendMessage(params)
      .promise()
      .then((res) => {
        Core.log(`Send message to SQS, QueueUrl: ${queueUrl}`);
        return res;
      })
      .catch((error) => {
        Core.log(`Error send message to SQS, QueueUrl: ${queueUrl}, message: `, message);
        Core.logError('SQS sendMessage failed', error);
        throw error;
      });
  }
}
