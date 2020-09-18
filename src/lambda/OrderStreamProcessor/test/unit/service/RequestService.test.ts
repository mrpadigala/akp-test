import RequestService from '../../../service/RequestService';

const event = require('../../data/event.json');
const records = require('../../data/records.json');

describe('RequestService unit test', () => {
  it('check input data', async () => {
    const request = new RequestService(event);
    expect(request.getRecords()).toEqual(records);
  });
});
