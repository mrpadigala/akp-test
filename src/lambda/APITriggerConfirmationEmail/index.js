
const AWSXRay = require("aws-xray-sdk");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const { OMS } = require('plt-layer');

let docClient;
let lambda;

exports.handler = async event => {

  docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });
  lambda = new AWS.Lambda({ region: process.env.AWS_REGION });

  try {
    const orderId = event.pathParameters.order_id;
    if (!orderId) {
      return buildResponse(422, { error: "Missing order_id path" });
    }

    let order = await OMS.Order.getById(orderId);
    if (!order) {
      return buildResponse(404, {
        error: `No Order Found (OrderId: ${orderId})`
      });
    }

    let result = await invokeLambdaOrderConfirmation(orderId);
    if (result.FunctionError) {
      throw new Error(
        `Sending Order Confirmation email failed (OrderId: ${orderId})`
      );
    }

    return buildResponse(200, { success: true });
  } catch (err) {
    console.error(err);
    return buildResponse(500, { error: err.message });
  }
};

function invokeLambdaOrderConfirmation(orderId) {
  const params = {
    FunctionName: process.env.LAMBDA_CONFIRMATION_EMAIL,
    Payload: JSON.stringify({
      OrderId: orderId,
      TableName: "Orders"
    })
  };

  return lambda.invoke(params).promise();
}

function buildResponse(code, result) {
  return {
    statusCode: code,
    headers: {
      plt_api: "internal"
    },
    body: JSON.stringify(result),
    isBase64Encoded: false
  };
}
