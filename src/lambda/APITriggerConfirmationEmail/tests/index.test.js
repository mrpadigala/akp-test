
const AWS = require("aws-sdk-mock");

let lambdaFunc;

jest.mock("plt-layer", () => {
  return {
    getOrderById: jest.fn()
  };
}, {'virtual':true});

jest.mock(
  "plt-layer",
  () => {
    return {
      OMS: {
        Order: {
          getById: jest.fn()
        }
      }
    };
  },
  { virtual: true }
);
const { OMS } = require("plt-layer");

describe("Lambda function `APITriggerConfirmationEmail` test", () => {
  afterEach(() => {
    AWS.restore();

    process.env.LAMBDA_CONFIRMATION_EMAIL = "test";

    lambdaFunc = null;
  });

  beforeEach(() => {
    OMS.Order.getById.mockImplementation( () => {
      return {
          OrderNumber: "1234569",
          OrderId: "9e62a8fa-7619-4dcb-80e8-04543f1xxxx",
          CustomerDetails: {
            Email: "shahid.hussain@prettylittlething.com",
            FirstName: "Shahid",
            LastName: "Hussain"
          },
          Email: "shahid.hussain@prettylittlething.com",
          EstimatedDeliveryDate: "2018-12-09",
          IndexPostcodeLastName: "48047-2175test",
          Items: [
            {
              Name: "Lashanti Black Unitard ",
              Sku: "CLR0555/4/58"
            }
          ]
      }
    });

    lambdaFunc = require("../index");
  });

  it("it should return error if order path is missing ", async () => {
    const result = await lambdaFunc.handler({pathParameters: {other: 123}});

    expect(result.statusCode).toBe(422);
    expect(result.body).toEqual('{"error":"Missing order_id path"}');
  });

  it("it should sucessfully send order confirmation email", async () => {
    AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
      callback(null, {Item: {}});
    });

    AWS.mock("Lambda", "invoke", (params, callback) => {
      const payload = JSON.parse(params.Payload);

      expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
      expect(payload.TableName).toMatch("Orders");
      expect(payload.OrderId).toMatch("123");

      callback(null, "invoked");
    });

    const result = await lambdaFunc.handler({
      pathParameters: {order_id: "123"}
    });
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual('{"success":true}');
  });

  it("it should fail to send order confirmation email", async () => {
    AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
      callback(null, {Item: {}});
    });

    AWS.mock("Lambda", "invoke", (params, callback) => {
      callback(null, {
        FunctionError: "error"
      });
    });

    const result = await lambdaFunc.handler({
      pathParameters: {order_id: "123"}
    });
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual('{"error":"Sending Order Confirmation email failed (OrderId: 123)"}');
  });

  it("it should work with mocked layer", async () => {
    process.env.USE_LAMBDA_LAYER = "true";

    AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
      callback(new Error('should have used layer'), {Item: {}});
    });

    AWS.mock("Lambda", "invoke", (params, callback) => {
      const payload = JSON.parse(params.Payload);

      expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
      expect(payload.TableName).toMatch("Orders");
      expect(payload.OrderId).toMatch("123");

      callback(null, "invoked");
    });

    const result = await lambdaFunc.handler({
      pathParameters: {order_id: "123"}
    });
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual('{"success":true}');

  });
});

describe("No return message", () => {
  it("it should return error if order is not found", async () => {
    OMS.Order.getById.mockImplementation( () => {
      return false;
    });

    lambdaFunc = require("../index");

    AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
      callback(new Error('should have used layer'), {Item: {}});
    });

    const result = await lambdaFunc.handler({
      pathParameters: { order_id: "123" }
    });
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual('{"error":"No Order Found (OrderId: 123)"}');
  });

});