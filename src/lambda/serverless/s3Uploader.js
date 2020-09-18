const AWS = require('aws-sdk');
const fs = require('fs').promises;

module.exports.webhook = async (event) => {
  try {
    const S3 = new AWS.S3({
      s3ForcePathStyle: true,
      accessKeyId: 'S3RVER', // This specific key is required when working offline
      secretAccessKey: 'S3RVER',
      endpoint: new AWS.Endpoint('http://localhost:8008'),
    });
    S3.putObject(
      {
        Bucket: event.queryStringParameters.bucket,
        Key: event.queryStringParameters.key,
        // eslint-disable-next-line no-buffer-constructor
        Body: new Buffer(
          await fs.readFile(`./serverless/s3/uploader/${  event.queryStringParameters.filename}`, 'binary'),
        ),
      },
      () => {
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'success' }),
          isBase64Encoded: false,
        };
      }
    );
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'fail', error }),
      isBase64Encoded: false,
    };
  }
};
