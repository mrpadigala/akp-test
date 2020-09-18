import ResponseService from '../../service/ResponseService';

describe('Response unit test', () => {
  it('check JSON output', async () => {
    const response = new ResponseService(200, { resp: 'test' });
    expect(response.toJSON()).toEqual({
      statusCode: 200,
      body: "{\"resp\":\"test\"}",
      isBase64Encoded: false,
    });
  });
});
