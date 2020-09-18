"use strict";

const AWS = require("aws-sdk-mock");
const moment = require("moment");
const MockAdapter = require("axios-mock-adapter");
const mockAxios = new MockAdapter(require("axios"));

const fetchMany = jest.fn(() => {
  return require('./data/product-service-api-many.json');
});
jest.spyOn(require('@prettylittlething/product-service'), 'productService')
    .mockImplementation(() => ({ fetchMany }));

const lambdaFunc = require("../index");
const request = require("./data/request");
const requestSkuDuplicates = require("./data/requestSkuDuplicates");
const expectSQSMessage = require("./data/expectedSQSMessage");
const expectedSQSMessageSkuDuplicates = require("./data/expectedSQSMessageSkuDuplicates");
const apiResponses = require("./data/expectedAPIResponses");

const expectOrderNumber = "19-0370414-9083200";

describe("APIOrderPut Lambda Handler", () => {
  afterEach(() => {
    AWS.restore();
  });

  beforeEach(() => {
    process.env.SQS_QUEUE_URL = "CCS-OrderCreate-OMS";
    process.env.PRODUCT_SERVICE_URL = "https://zq9m7jaojk.execute-api.eu-west-1.amazonaws.com/prod";
    process.env.PRODUCT_SERVICE_KEY_SSM_PARAM = "/oms/product_api_key";
    mockOrderNumberPool();
  });

  describe("Successfully published Order into Queue", () => {
    it("should successfully publish Order Create into Queue with valid request", async () => {
      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);

        var dateRegexp = new RegExp(moment().format("YYYY-MM-DD HH:") + "(.*)");
        expect(message.OrderNumber).toEqual(`1${expectOrderNumber}`);
        expect(message.OrderDate).toEqual(expect.stringMatching(dateRegexp));
        expect(
          message.OrderCreateTime > parseInt(moment().format("X")) - 10
        ).toEqual(true);

        delete message.OrderNumber;
        delete message.OrderDate;
        delete message.OrderCreateTime;
        delete message.OrderCreateDate;
        expect(message).toEqual(expectSQSMessage);

        callback();
      });

      let result = await lambdaFunc.handler(getRequest(request));

      expect(result).toEqual(apiResponses.Positive);
    });

    it("should merge the duplicated SKU and successfully publish Order Create into Queue with valid request", async () => {
      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);

        var dateRegexp = new RegExp(moment().format("YYYY-MM-DD HH:") + "(.*)");
        expect(message.OrderNumber).toEqual(`1${expectOrderNumber}`);
        expect(message.OrderDate).toEqual(expect.stringMatching(dateRegexp));
        expect(
          message.OrderCreateTime > parseInt(moment().format("X")) - 10
        ).toEqual(true);

        delete message.OrderNumber;
        delete message.OrderDate;
        delete message.OrderCreateTime;
        delete message.OrderCreateDate;
        expect(message).toEqual(expectedSQSMessageSkuDuplicates);

        callback();
      });

      let result = await lambdaFunc.handler(getRequest(requestSkuDuplicates));

      expect(result).toEqual(apiResponses.Positive);
    });

    it("should successfully Order Create into Queue when input request is a String of JSON stringify", async () => {
      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);

        var dateRegexp = new RegExp(moment().format("YYYY-MM-DD HH:") + "(.*)");

        expect(message.OrderNumber).toEqual(`1${expectOrderNumber}`);
        expect(message.OrderDate).toEqual(expect.stringMatching(dateRegexp));
        expect(
          message.OrderCreateTime > parseInt(moment().format("X")) - 10
        ).toEqual(true);

        delete message.OrderNumber;
        delete message.OrderDate;
        delete message.OrderCreateTime;
        delete message.OrderCreateDate;
        expect(message).toEqual(expectSQSMessage);

        callback();
      });

      let result = await lambdaFunc.handler(
        getRequest(JSON.stringify(request))
      );

      expect(result).toEqual(apiResponses.Positive);
    });

    it("should publish to queue with additional request fields", async () => {
      let newFieldValue = "Some test value";

      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);

        var dateRegexp = new RegExp(moment().format("YYYY-MM-DD HH:") + "(.*)");

        expect(message.OrderNumber).toEqual(`1${expectOrderNumber}`);
        expect(message.OrderDate).toEqual(expect.stringMatching(dateRegexp));
        expect(
          message.OrderCreateTime > parseInt(moment().format("X")) - 10
        ).toEqual(true);

        delete message.OrderNumber;
        delete message.OrderDate;
        delete message.OrderCreateTime;
        delete message.OrderCreateDate;

        let newSQSMessage = JSON.parse(JSON.stringify(expectSQSMessage));

        newSQSMessage.CustomField = newFieldValue;

        expect(message).toEqual(newSQSMessage);

        callback();
      });

      let newRequest = JSON.parse(JSON.stringify(request));

      newRequest.CustomField = newFieldValue;

      let result = await lambdaFunc.handler(getRequest(newRequest));

      expect(result).toEqual(apiResponses.Positive);
    });

    it("should publish to queue with correct Order Number depending on StoreId", async () => {
      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);

        expect(message.OrderNumber).toEqual(`7${expectOrderNumber}`);

        callback();
      });

      let newRequest = JSON.parse(JSON.stringify(request));

      newRequest.StoreId = "7";

      let result = await lambdaFunc.handler(getRequest(newRequest));

      let apiResponse = JSON.parse(JSON.stringify(apiResponses.Positive));

      apiResponse.body = '{"OrderNumber":"719-0370414-9083200"}';

      expect(result).toEqual(apiResponse);
    });

    it("should query from PIM when Price/OriginalPrice/Name fields is missing from the Items request", async () => {
      AWS.mock("SSM", "getParameter", (params, callback) => {
        if (params.Name === '/oms/product_api_key') {
          callback(null, {
            Parameter: {
              Value: "Rlf0RAUiTS3IcioeERGDb3usVdFzHFbv688B5vwa"
            },
          });
        } else {
          expect(params.Name).toEqual("pim-es.plt-api-key");
          callback(null, {
            Parameter: {
              Value: "1234567899999"
            }
          });
        }
      });

      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);
        let dateRegexp = new RegExp(moment().format("YYYY-MM-DD HH:") + "(.*)");

        expect(message.OrderNumber).toEqual(`1${expectOrderNumber}`);
        expect(message.OrderDate).toEqual(expect.stringMatching(dateRegexp));
        expect(
          message.OrderCreateTime > parseInt(moment().format("X")) - 10
        ).toEqual(true);

        delete message.OrderDate;
        delete message.OrderCreateTime;
        delete message.OrderCreateDate;
        expect(message).toEqual(
          require("./data/expectedSQSMessageVogaClosest.json")
        );

        callback();
      });

      let result = await lambdaFunc.handler(
        getRequest(require("./data/requestVogacloset"))
      );

      expect(result).toEqual(apiResponses.Positive);
    });

    it("right storename based on StoreId", async () => {
      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);
        expect(message.OrderNumber).toEqual(`10${expectOrderNumber}`);
        expect(message.StoreName).toEqual(`prettylittlething.qa`);
        callback();
      });

      let newRequest = JSON.parse(JSON.stringify(request));

      newRequest.StoreId = "10";

      let result = await lambdaFunc.handler(getRequest(newRequest));

      let apiResponse = JSON.parse(JSON.stringify(apiResponses.Positive));

      apiResponse.body = '{"OrderNumber":"1019-0370414-9083200"}';

      expect(result).toEqual(apiResponse);
    });
  });

  describe("Negative - Error API Response", () => {
    it("it should response with server error (status code: 500)", async () => {
      AWS.mock("SQS", "sendMessage", (params, callback) => {
        callback(new Error("Errors..."));
      });

      let result = await lambdaFunc.handler(getRequest(request));

      expect(result).toEqual(apiResponses.ServerError);
    });

    it("it should response with validation error (status code: 422)", async () => {
      let result = await lambdaFunc.handler(
        getRequest(require("./data/validationErrorRequest"))
      );

      expect(result).toEqual(apiResponses.ValidationError);
    });
  });
});

function getRequest(data) {
  return {
    body: data
  };
}

function mockOrderNumberPool() {
  AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
    if (params.TableName === "OrderNumberPool") {
      callback(null, {
        Count: 1,
        Items: [
          {
            Allocated: "false",
            OrderNumber: "19-0370414-9083200"
          }
        ]
      });
    }

    callback("Error");
  });

  AWS.mock("DynamoDB.DocumentClient", "update", (params, callback) => {
    if (params.TableName === "OrderNumberPool") {
      callback(null, {});
    }

    callback("Error");
  });
}
