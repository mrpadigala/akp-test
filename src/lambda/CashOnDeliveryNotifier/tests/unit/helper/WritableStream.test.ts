import WritableStream from '../../../helper/WritableStream';

describe('WritableStream class', () => {
  it('should set OrderId', async () => {
    const writableStream = new WritableStream();
    writableStream._write('string1', '', () => {});
    writableStream._write('string2', '', () => {});
    expect(writableStream.getData()).toBe('string1\nstring2');
  });
});
