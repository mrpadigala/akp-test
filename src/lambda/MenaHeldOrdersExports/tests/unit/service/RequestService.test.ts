import RequestService from '../../../service/RequestService';

const event = require('../../data/event.json');

describe('RequestService unit test', () => {
  it('check input data', async () => {
    const request = new RequestService(event);
    expect(request.getPage()).toEqual('fdfdfdFSdfSDfsdfsdf');
  });

  it('check empty input data', async () => {
    const request = new RequestService({}, { page: null });
    expect(request.getPage()).toEqual(null);
  });
});
