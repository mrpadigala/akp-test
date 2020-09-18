import RequestService from '../../../service/RequestService';

const event = require('../../data/event.json');
const eventWrong = require('../../data/eventWrong.json');

function getService(event) {
  return new RequestService(event);
}

describe('RequestService class', () => {
  it('should return array of files', async () => {
    const file = getService(event).getFile();
    expect(file).toEqual({
      bucket: 'plt-prod.cash-on-delivery.eu-west-1',
      filename: 'incoming/file1.csv',
    });
  });

  it('should throw input error', async () => {
    const fn = jest.fn();
    try {
      getService(eventWrong);
    } catch (e) {
      fn();
      expect(e.message).toBe('Wrong event name');
    }

    expect(fn).toBeCalledTimes(1);
  });
});
