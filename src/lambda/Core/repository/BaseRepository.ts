import { DocumentClient } from 'aws-sdk/clients/dynamodb';

export default abstract class BaseRepository<T> {
  protected docClient;

  constructor(docClient: DocumentClient) {
    this.docClient = docClient;
  }
}
