import * as fs from 'fs';
import RequestService from '../../../service/RequestService';

const validEvent = fs.readFileSync(__dirname + '/../../data/validEvent.xml', 'utf8');
const invalidEventBadWorldpayObject = fs.readFileSync(__dirname + '/../../data/invalidEventBadWorldpayObject.xml', 'utf8');
const invalidEventBadStatus = fs.readFileSync(__dirname + '/../../data/invalidEventBadStatus.xml', 'utf8');

describe('RequestService unit test', () => {
  Date.now = jest.fn(() => new Date(Date.UTC(2020, 9, 11)).valueOf())

  it('returns success entity', async () => {
    const request = new RequestService(getEvent(validEvent));
    expect(request.getOrderId()).toEqual('12312-123-123213-213');
    expect(request.getStatus()).toEqual('AUTHORISED');
    expect(request.getRawMessage()).toEqual(validEvent);
  });

  it('throw error bad xml structure', async () => {
    const fn = jest.fn();
    try {
      new RequestService(getEvent(invalidEventBadWorldpayObject));
    } catch (e) {
      expect(e.message).toEqual('Parse status error');
      fn();
    }
    expect(fn).toBeCalledTimes(1);
  });

  it('throw error empty status', async () => {
    const fn = jest.fn();
    try {
      new RequestService(getEvent(invalidEventBadStatus));
    } catch (e) {
      expect(e.message).toEqual('Parse status error');
      fn();
    }
    expect(fn).toBeCalledTimes(1);
  });
});

function getEvent(body) {
  return {
    body,
    headers: {},
    multiValueHeaders: {},
    httpMethod: '',
    isBase64Encoded: false,
    path: '',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: null,
    resource: ''
  }
}
