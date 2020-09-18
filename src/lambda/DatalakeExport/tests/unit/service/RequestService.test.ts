import RequestService from '../../../service/RequestService';

const event = require('../../data/event.json');

function getService(event) {
  return new RequestService(event);
}

describe('RequestService class', () => {
  it('should return array of files', async () => {
    const records = getService(event).getRecords();
    expect(records).toEqual([
      {
        awsRegion: 'us-west-1',
        eventName: 'ObjectCreated:Put',
        eventSource: 'aws:s3',
        eventTime: '1970-01-01T00:00:00.000Z',
        eventVersion: '2.0',
        requestParameters: {
          sourceIPAddress: '127.0.0.1',
        },
        responseElements: {
          'x-amz-id-2': 'FMyUVURIY8/IgAtTv8xRjskZQpcIZ9KG4V5Wp6S7S/JRWeUWerMUE5JgHvANOjpD',
          'x-amz-request-id': 'C3D13FE58DE4C810',
        },
        s3: {
          bucket: {
            arn: 'arn:aws:s3:::sourcebucket',
            name: 'plt-bucket',
            ownerIdentity: {
              principalId: 'A3NL1KOZZKExample',
            },
          },
          configurationId: 'testConfigRule',
          object: {
            eTag: 'd41d8cd98f00b204e9800998ecf8427e',
            key: 'incoming/file1%23qwerty.csv',
            size: 1024,
            versionId: '096fKKXTRTtl3on89fVO.nfljtsv6qko',
          },
          s3SchemaVersion: '1.0',
        },
        userIdentity: {
          principalId: 'AIDAJDPLRKLG7UEXAMPLE',
        },
      },
    ]);
  });
});
