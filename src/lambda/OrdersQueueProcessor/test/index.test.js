const AWS = require("aws-sdk-mock");

Date.now = jest.fn(() => 1487076708000)

jest.mock(
    "plt-layer",
    () => {
      return {
        OMS: {
          Order: {
            getByOrderNumber: jest.fn(),
            createOrder: jest.fn(),
          },
          Log: {
            add: jest.fn(),
          },
        }
      };
    },
    { virtual: true }
);
const { OMS } = require('plt-layer');

const lambdaFunc = require("../index");
let mockOrder = require("./__mocks__/order");
let mockOrderForEggplant = require("./__mocks__/orderForEggplant");
let mockOrderDuplicate = require("./__mocks__/orderDuplicate");
const mockAdapter = require("axios-mock-adapter");
const axios = new mockAdapter(require("axios"));
const xmlJs = require('xml-js');

const {
  describe, beforeEach, afterEach, it, expect,
} = global;

const responseWorldPaySuccess = {
  declaration: {
    attributes: {
      version: "1.0",
      encoding: "utf-8"
    }
  },
  elements: [{
    type: "element",
    name: "paymentService",
    attributes: {
      version: "1.4",
      merchantCode: "PLTGBP"
    },
    elements: [{
      type: "element",
      name: "reply",
      elements: [{
        type: "element",
        name: "orderStatus",
        attributes: {
          orderCode: "TransactionID-1234567890"
        },
        elements: [{
          type: "element",
          name: "payment",
          elements: [{
            type: "element",
            name: "lastEvent",
            elements: [{
              type: "text",
              text: "CAPTURED"
            }]
          }]
        }]
      }]
    }]
  }]
};

const responseWorldPayFailed = {
  declaration: {
    attributes: {
      version: "1.0",
      encoding: "utf-8"
    }
  },
  elements: [{
    type: "element",
    name: "paymentService",
    attributes: {
      version: "1.4",
      merchantCode: "PLTGBP"
    },
    elements: [{
      type: "element",
      name: "reply",
      elements: [{
        type: "element",
        name: "orderStatus",
        attributes: {
          orderCode: "TransactionID-1234567890"
        },
        elements: [{
          type: "element",
          name: "payment",
          elements: [{
            type: "element",
            name: "lastEvent",
            elements: [{
              type: "text",
              text: "CANCELLED"
            }]
          }]
        }]
      }]
    }]
  }]
};

const responseWorldPayRefused = {
  declaration: {
    attributes: {
      version: "1.0",
      encoding: "utf-8"
    }
  },
  elements: [{
    type: "element",
    name: "paymentService",
    attributes: {
      version: "1.4",
      merchantCode: "PLTGBP"
    },
    elements: [{
      type: "element",
      name: "reply",
      elements: [{
        type: "element",
        name: "orderStatus",
        attributes: {
          orderCode: "TransactionID-1234567890"
        },
        elements: [{
          type: "element",
          name: "payment",
          elements: [{
            type: "element",
            name: "lastEvent",
            elements: [{
              type: "text",
              text: "REFUSED"
            }]
          }]
        }]
      }]
    }]
  }]
};

const wpOrderNotReady = {
  declaration: {
    attributes: {
      version: "1.0",
      encoding: "utf-8"
    }
  },
  elements: [{
    type: "element",
    name: "paymentService",
    attributes: {
      version: "1.4",
      merchantCode: "PLTGBP"
    },
    elements: [{
      type: "element",
      name: "reply",
      elements: [{
        type: "element",
        name: "orderStatus",
        attributes: {
          orderCode: "TransactionID-1234567890"
        },
        elements: [{
          type: "element",
          name: "error",
          attributes: {
            code: "5"
          },
          elements: [{
           type: "cdata",
           cdata: "Order not ready"
          }]
        }]
      }]
    }]
  }]
};

const SSM = {
  'oms.worldpay-refund-credentials': {
    Parameter: {
      Value: JSON.stringify({
        Credentials: {
          MERCHANT_PLTAUD_USER: 'MERCHANT_PLTAUD_USER',
          MERCHANT_PLTAUD_PASS: 'MERCHANT_PLTAUD_PASS',
          MERCHANT_PLTEUR_USER: 'MERCHANT_PLTEUR_USER',
          MERCHANT_PLTEUR_PASS: 'MERCHANT_PLTEUR_PASS',
          MERCHANT_PLTGBP_USER: 'MERCHANT_PLTGBP_USER',
          MERCHANT_PLTGBP_PASS: 'MERCHANT_PLTGBP_PASS',
          MERCHANT_PLTUSD_USER: 'MERCHANT_PLTUSD_USER',
          MERCHANT_PLTUSD_PASS: 'MERCHANT_PLTUSD_PASS',
        },
      }),
    },
  },
  '/oms/integrations/ccs-api-key': {
    Parameter: {
      Value: 'token',
    },
  },
};

const testWorldPayServer = 'wpserver.dev';

process.env.WORLD_PAY_URL = testWorldPayServer;
process.env.INVOKE_WORLD_PAY_CHECK="true";

process.env.CUSTOMER_INFORMATION_API_ENDPOINT = 'test-customer.com';
process.env.CUSTOMER_INFORMATION_API_KEY_SSM_PARAM_NAME = '/oms/integrations/ccs-api-key';

describe("Lambda Function Test", () => {
  afterEach(() => {
    AWS.restore();
  });

  beforeEach(() => {
    AWS.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, SSM[params.Name]);
    });

    axios.onPost(testWorldPayServer).reply(() => {
      return [200, xmlJs.js2xml(responseWorldPaySuccess, {
        compact: false,
        ignoreDoctype: true,
        doctypeKey: "doctype",
        spaces: 1
      })];
    });
  });

  describe("Successful Order Test", () => {
    beforeEach(() => {
      AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
        if (params.TableName === "OrdersPending") {
          callback(null, { Count: 0 });
        }
      });

      OMS.Order.getByOrderNumber.mockImplementation(() => {
        return false;
      });

      AWS.mock("StepFunctions", "startExecution", (params, callback) => {
        callback(null, "invoked");
      });

      process.env.LAMBDA_CONFIRMATION_EMAIL = "OMS-OrderProcessing-TriggerConfirmationEmail";
      process.env.APPLY_ROYALTY_STATE_MACHINE_ARN = "arn:....:ApplyRoyaltyStateMachine";
      process.env.NOTIFY_DMS_STATE_MACHINE_ARN = "arn:....:NotifyDMSStateMachine";
      process.env.INVOKE_INVENTORY_STEP = "true";
      process.env.WMS_INVENTORY_SNS_TOPIC = "arn:....:snsTopic";
      process.env.ORDER_PROCESSOR_STATE_MACHINE_ARN = "arn:....:OrderProcessorStateMachine";
      process.env.HELD_MENA_ORDER = "true";
    });


    it("should insert an Order in the `Orders` table", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.TableName).toEqual("Orders");

        expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
        expect(params.Item.Email).toEqual("test@tt.com");
        expect(params.Item.CustomerId).toEqual("0");
        expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(params.Item.NotShipped).toEqual('2019-02-15');
        callback();
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
          callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("Orders");

        callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();
      await lambdaFunc.handler(prepareEvent(orderEvent));

    });

    it("should insert an Order in the `Orders` table with time out response status", async () => {
      axios.reset();
      axios.onPost(testWorldPayServer).timeout();

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.TableName).toEqual("Orders");

        expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
        expect(params.Item.Email).toEqual("test@tt.com");
        expect(params.Item.CustomerId).toEqual("0");
        expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        callback();
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("Orders");

        callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();
      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should flag royalty only order", async () => {
      const fn = jest.fn();
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if (params.TableName === 'Reports') {
          fn();
          expect(params).toEqual({
            TableName: 'Reports',
            Item: {
              EntityId: 'order',
              EntityType: 'royaltyOnly#2017-02-14-14-51#1487076708000',
              Data: { OrderNumber: '119-0370193-3633441' },
              CreatedAt: '1487076708000',
              TTL: '1494762708',
            },
          });
        } else {
          expect(params.Item.RoyaltyOnly).toEqual('true');
        }
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"YEARLY-SUBSCRIPTION","ProductQty":-1}');
          callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.Items[0].Sku = 'YEARLY-SUBSCRIPTION';

      await lambdaFunc.handler(prepareEvent(orderEvent));
      expect(fn).toBeCalledTimes(1);
    });

    it("should flag royalty only irish order", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.Item.RoyaltyOnly).toEqual('true');
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"Year-Subscription-Ireland","ProductQty":-1}');
        callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.Items[0].Sku = 'Year-Subscription-Ireland';

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should insert an Order in the `OrdersPending` table (Fraud Check Required)", async () => {
      expect.assertions(13);
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if(params.TableName === "OrdersPending") {
          expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
          expect(params.Item.Email).toEqual("test@tt.com");
          expect(params.Item.CustomerId).toEqual("0");
          expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        }

        if (params.TableName === "OrdersLogs") {
          expect(params.Item.Comment).toEqual("Order Pending due to fraud checks");
          expect(params.Item.OrderId).toEqual("119-0370193-3633441");
          expect(params.Item.Type).toEqual("Fraudcheck Required");
          expect(params.Item.User).toMatch('');
          expect(params.Item.UserId).toMatch('');
        }

        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("OrdersPending");

        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
          callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CurrencyCode = "USD";
      orderEvent.Records[0].body.OrderTotal = "800.50";

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should insert an Order in the `OrdersPending` table - test all currencies", async () => {
      expect.assertions(14);
      const rules = {
        GBP: 500,
        EUR: 565,
        AUD: 850,
        USD: 650,
        CAD: 850,
        NZD: 950,
        ILS: 2200,
        QAR: 2500,
        BHD: 250,
        JOD: 450,
        KWD: 200,
        OMR: 250,
        SAR: 2500,
        AED: 2500,
      };

      for (let [currency, limit] of Object.entries(rules)) {
        AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
          if(params.TableName === "OrdersPending") {
            expect(params.Item.Email).toEqual("test@tt.com");
          }
          callback();
        });

        AWS.mock("Lambda", "invoke", (params,callback) => {
          callback(null, "invoked");
        });

        AWS.mock("SNS", "publish", (params, callback) => {
          callback();
        });

        AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
          if (params.TableName === "OrdersPending") {
            callback(null, { Count: 0 });
          }
        });

        AWS.mock('SSM', 'getParameter', (params, callback) => {
          callback(null, SSM[params.Name]);
        });

        const orderEvent = mockOrderEvent();
        orderEvent.Records[0].body.CurrencyCode = currency;
        orderEvent.Records[0].body.OrderTotal = limit + 1;

        await lambdaFunc.handler(prepareEvent(orderEvent));
        AWS.restore();
      }
    });

    it("should insert an Order Log Message in the `OrdersLogs` table (Fraud Check Required)", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if (params.TableName === "OrdersLogs") {
          expect(params.Item.Comment).toEqual("Order Pending due to fraud checks");
          expect(params.Item.OrderId).toEqual("119-0370193-3633441");
          expect(params.Item.Type).toEqual("Fraudcheck Required");
          expect(params.Item.User).toMatch('');
          expect(params.Item.UserId).toMatch('');
        }
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CurrencyCode = "USD";
      orderEvent.Records[0].body.OrderTotal = "800.50";

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should insert an Order in the `OrdersPending` table (Fraud Check Required) if a Customer Email is Blacklisted", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if (params.TableName === "OrdersPending") {
          expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
          expect(params.Item.Email).toEqual("something@yopmail.com");
          expect(params.Item.CustomerId).toEqual("0");
          expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        }

        if (params.TableName === "OrdersLogs") {
          expect(params.Item.Comment).toEqual("Order Pending due to fraud checks");
          expect(params.Item.OrderId).toEqual("119-0370193-3633441");
          expect(params.Item.Type).toEqual("Fraudcheck Required");
          expect(params.Item.User).toMatch('');
          expect(params.Item.UserId).toMatch('');
        }

        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("OrdersPending");

        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
          callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CustomerDetails.Email = "something@yopmail.com";

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should insert an Order in the `OrdersPending` table (Fraud Check Required) if paymentmethod is free-payment and not PLT email", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if (params.TableName === "OrdersPending") {
          expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
          expect(params.Item.Email).toEqual("something@normal.com");
          expect(params.Item.CustomerId).toEqual("0");
          expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        }

        if (params.TableName === "OrdersLogs") {
          expect(params.Item.Comment).toEqual("Order Pending due to fraud checks");
          expect(params.Item.OrderId).toEqual("119-0370193-3633441");
          expect(params.Item.Type).toEqual("Fraudcheck Required");
          expect(params.Item.User).toMatch('');
          expect(params.Item.UserId).toMatch('');
        }

        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("OrdersPending");

        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CustomerDetails.Email = "something@normal.com";
      orderEvent.Records[0].body.PaymentDetails.AdditionalInformation.PaymentMethod = 'free-payment';

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should insert an Order in the `OrdersPending` table (Fraud Check Required) - Israel", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if(params.TableName === "OrdersPending") {
          expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
          expect(params.Item.Email).toEqual("test@tt.com");
          expect(params.Item.CustomerId).toEqual("0");
          expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        }

        if (params.TableName === "OrdersLogs") {
          expect(params.Item.Comment).toEqual("Order Pending due to fraud checks");
          expect(params.Item.OrderId).toEqual("119-0370193-3633441");
          expect(params.Item.Type).toEqual("Fraudcheck Required");
          expect(params.Item.User).toMatch('');
          expect(params.Item.UserId).toMatch('');
        }

        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("OrdersPending");

        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
          callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CurrencyCode = "ILS";
      orderEvent.Records[0].body.OrderTotal = "2200.50";

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should insert an Order in the `Orders` table if paymentmethod is free-payment and IS from a PLT email", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.TableName).toEqual("Orders");

        expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
        expect(params.Item.Email).toEqual("something@prettylittlething.com");
        expect(params.Item.CustomerId).toEqual("0");
        expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("Orders");

        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CustomerDetails.Email = "something@prettylittlething.com";
      orderEvent.Records[0].body.PaymentDetails.AdditionalInformation.PaymentMethod = 'free-payment';

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should invoke ApplyRoyalty lambda", async () => {
      let invokedLambdaApplyRoyalty = false;

      process.env.INVOKE_ROYALTY_STEP = 'true';

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
          expect(params.TableName).toEqual("Orders");

          expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
          expect(params.Item.Email).toEqual("test@tt.com");
          expect(params.Item.CustomerId).toEqual("0");
          expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
          callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
          const payload = JSON.parse(params.Payload);

          expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
          expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
          expect(payload.TableName).toMatch("Orders");

          callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
          callback();
      });

      AWS.remock("StepFunctions", "startExecution", (params, callback) => {
        if (params.stateMachineArn == "arn:....:ApplyRoyaltyStateMachine") {
          expect(params).toEqual(
            expect.objectContaining({
              stateMachineArn: process.env.APPLY_ROYALTY_STATE_MACHINE_ARN
            })
          );
          expect(params.input).toMatch(/[{"CustomerId":"0","ExecutionId": "Customer\-0\-Time-][0-9]*["]/);
          expect(params.name).toMatch(/[Customer\-0\-Time-][0-9]*/);

          const input = JSON.parse(params.input);
          expect(input.CustomerUuid).toBe("12345678");

          invokedLambdaApplyRoyalty = true;
        }
        callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();

      orderEvent.Records[0].body.Items.push({
          "Sku": "YEARLY-SUBSCRIPTION"
      });

      await lambdaFunc.handler(prepareEvent(orderEvent));

      expect(invokedLambdaApplyRoyalty).toEqual(true);
    });

    it("US unlimited - should invoke ApplyRoyalty lambda", async () => {
      expect.assertions(4);
      process.env.INVOKE_ROYALTY_STEP = 'true';

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
          callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
          callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
          callback();
      });

      AWS.remock("StepFunctions", "startExecution", (params, callback) => {
        if (params.stateMachineArn == "arn:....:ApplyRoyaltyStateMachine") {
          expect(params).toEqual(
            expect.objectContaining({
              stateMachineArn: process.env.APPLY_ROYALTY_STATE_MACHINE_ARN
            })
          );
          expect(params.input).toMatch(/[{"CustomerId":"0","ExecutionId": "Customer\-0\-Time-][0-9]*["]/);
          expect(params.name).toMatch(/[Customer\-0\-Time-][0-9]*/);

          const input = JSON.parse(params.input);
          expect(input.CustomerUuid).toBe("12345678");
        }
        callback(null, "invoked");
      });

      const orderEvent = JSON.parse(JSON.stringify(mockOrderEvent()));

      orderEvent.Records[0].body.ShippingDetails.Method = 'pltshippingus_pltshippingus';

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("US unlimited virtual product - should invoke ApplyRoyalty lambda", async () => {
      expect.assertions(4);
      process.env.INVOKE_ROYALTY_STEP = 'true';

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
          callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
          callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
          callback();
      });

      AWS.remock("StepFunctions", "startExecution", (params, callback) => {
        if (params.stateMachineArn == "arn:....:ApplyRoyaltyStateMachine") {
          expect(params).toEqual(
            expect.objectContaining({
              stateMachineArn: process.env.APPLY_ROYALTY_STATE_MACHINE_ARN
            })
          );
          expect(params.input).toMatch(/[{"CustomerId":"0","ExecutionId": "Customer\-0\-Time-][0-9]*["]/);
          expect(params.name).toMatch(/[Customer\-0\-Time-][0-9]*/);

          const input = JSON.parse(params.input);
          expect(input.CustomerUuid).toBe("12345678");
        }
        callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.Items.push({
        "Sku": "YEARLY-SUBSCRIPTION-US"
      });

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("it should invoke ApplyRoyalty lambda when shipping price is discounted to 100%", async () => {
      expect.assertions(4);
      process.env.INVOKE_ROYALTY_STEP = 'true';

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
          callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
          callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
          callback();
      });

      AWS.remock("StepFunctions", "startExecution", (params, callback) => {
        if (params.stateMachineArn == "arn:....:ApplyRoyaltyStateMachine") {
          expect(params).toEqual(
            expect.objectContaining({
              stateMachineArn: process.env.APPLY_ROYALTY_STATE_MACHINE_ARN
            })
          );
          expect(params.input).toMatch(/[{"CustomerId":"0","ExecutionId": "Customer\-0\-Time-][0-9]*["]/);
          expect(params.name).toMatch(/[Customer\-0\-Time-][0-9]*/);

          const input = JSON.parse(params.input);
          expect(input.CustomerUuid).toBe("12345678");
        }
        callback(null, "invoked");
      });

      const orderEvent = JSON.parse(JSON.stringify(mockOrderEvent()));

      orderEvent.Records[0].body.ShippingDetails.Method = 'pltshippingus_pltshippingus';
      orderEvent.Records[0].body.ShippingDetails.Price = '0.0000';
      orderEvent.Records[0].body.ShippingDetails.DiscountAmount = '7.99';

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should notify DMS via Step Function when an order has Discount Code", async () => {
      let invokedNotifyDmsStepFunction = false;
      process.env.INVOKE_NOTIFY_DMS_STEP = 'true';

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
          expect(params.TableName).toEqual("Orders");

          expect(params.Item.OrderNumber).toEqual("119-0370193-3633441");
          expect(params.Item.Email).toEqual("test@tt.com");
          expect(params.Item.CustomerId).toEqual("0");
          expect(params.Item.OrderId).toMatch(/[a-zA-Z0-9]/);
          expect(params.Item.DiscountCode).toMatch("VerySecretDiscountCode");
          callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
          const payload = JSON.parse(params.Payload);

          expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
          expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
          expect(payload.TableName).toMatch("Orders");

          callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
          callback();
      });

      AWS.remock("StepFunctions", "startExecution", (params, callback) => {
          if (params.stateMachineArn === process.env.NOTIFY_DMS_STATE_MACHINE_ARN) {
            expect(params.input).toMatch(/[{"OrderNumber:"119\-0370193\-3633441", DiscountCode":"VerySecretDiscountCode","ExecutionId": "OrderNumber\-119\-0370193\-3633441\-Time-][0-9]*["]/);
            expect(params.name).toMatch(/[OrderNumber\-119\-0370193\-3633441\-Time-][0-9]*/);

            invokedNotifyDmsStepFunction = true;
          }
          callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.DiscountCode = "VerySecretDiscountCode";
      await lambdaFunc.handler(prepareEvent(orderEvent));

      expect(invokedNotifyDmsStepFunction).toEqual(true);
    });

    it("should insert an Order in the `Orders` table - missing email", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.Item.Email).toEqual("customernotfound@prettylittlething.com");
        expect(params.Item.CustomerDetails.Email).toEqual("customernotfound@prettylittlething.com");
        callback();
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CustomerDetails.Email = undefined;
      await lambdaFunc.handler(prepareEvent(orderEvent));

    });

    it("should insert an Order in the `Orders` table - missing email but PayPal payment", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.Item.Email).toEqual("paypal@prettylittlething.com");
        callback();
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.CustomerDetails.Email = undefined;
      orderEvent.Records[0].body.PaymentDetails.AdditionalInformation.PayerEmail = 'paypal@prettylittlething.com';

      await lambdaFunc.handler(prepareEvent(orderEvent));

    });

    it('should held Mana Order - with reasons GpsMissing, NewCustomer and PassportIdOverThreshold', async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        expect(params.TableName).toEqual("OrdersV3");
        expect(params.Item.OrderId).toEqual("119-0370193-3633441");
        expect(params.Item.AttributeId).toEqual("MENA#Held");
        expect(params.Item.ReasonTypes).toEqual(['NewCustomer', 'GpsMissing', 'PassportIdOverThreshold']);
        callback();
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        const {Source, Date, ...message} = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        const payload = JSON.parse(params.Payload);

        expect(params.FunctionName).toEqual(process.env.LAMBDA_CONFIRMATION_EMAIL);
        expect(payload.OrderId).toMatch(/[a-zA-Z0-9]/);
        expect(payload.TableName).toMatch("Orders");

        callback(null, "invoked");
      });

      axios.onGet('test-customer.com/12345678').reply(() => {
        return [200, {
          Message: {},
        }];
      });

      const orderEvent = { ...mockOrderEvent() };
      orderEvent.Records[0].body.ShippingDetails.Method = "ae_cod"; // United Arab Emirates store
      orderEvent.Records[0].body.OrderTotal = 501;
      await lambdaFunc.handler(prepareEvent(orderEvent));

      expect(OMS.Log.add).toBeCalled();
    });

    it('should held Mana Order - not COD payment and passport threshold', async () => {
      expect.assertions(6);
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        expect(params.TableName).toEqual('OrdersV3');
        expect(params.Item.OrderId).toEqual('119-0370193-3633441');
        expect(params.Item.AttributeId).toEqual('MENA#Held');
        expect(params.Item.ReasonTypes).toEqual(['NewCustomer', 'PassportIdOverThreshold']);
        callback();
      });

      AWS.mock('SNS', 'publish', (params, callback) => {
        const { Source, Date, ...message } = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock('Lambda', 'invoke', (params,callback) => {
        callback(null, 'invoked');
      });

      const orderEvent = { ...mockOrderEvent() };
      orderEvent.Records[0].body.OrderTotal = 501;
      orderEvent.Records[0].body.ShippingDetails.Method = 'ae_cod'; // United Arab Emirates store
      orderEvent.Records[0].body.ShippingDetails.Additional = {
        Geo: {
          Lng: '46.681051',
          Lat: '24.712508',
        },
      };
      await lambdaFunc.handler(prepareEvent(orderEvent));

      expect(OMS.Log.add).toBeCalled();
    });

    it('should held Mana Order - customer blacklisted', async () => {
      expect.assertions(2);
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        expect(params.Item.ReasonTypes).toEqual(['BlacklistedCustomer']);
        callback();
      });

      AWS.mock('SNS', 'publish', (params, callback) => {
        const { Source, Date, ...message } = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock('Lambda', 'invoke', (params,callback) => {
        callback(null, 'invoked');
      });

      axios.onGet('test-customer.com/12345678').reply(() => {
        return [200, {
          Message: {
            CashOnDeliveryApproved: false,
          },
        }];
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.ShippingDetails.Method = 'ae_cod';
      orderEvent.Records[0].body.CustomerDetails.PassportID = 'test';
      orderEvent.Records[0].body.ShippingDetails.Additional = {
        Geo: {
          Lng: '46.681051',
          Lat: '24.712508',
        },
      };
      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it('should not held Mana Order - COD payment,passport,GPS is not empty', async () => {
      expect.assertions(1);
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        expect(true).toEqual(false);
        callback();
      });

      AWS.mock('SNS', 'publish', (params, callback) => {
        const { Source, Date, ...message } = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock('Lambda', 'invoke', (params,callback) => {
        callback(null, 'invoked');
      });

      axios.onGet('test-customer.com/12345678').reply(() => {
        return [200, {
          Message: {
            CashOnDeliveryApproved: true,
          },
        }];
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.ShippingDetails.Method = 'ae_cod'; // United Arab Emirates store
      orderEvent.Records[0].body.CustomerDetails.PassportID = 'test';
      orderEvent.Records[0].body.PaymentDetails.Method = 'COD';
      orderEvent.Records[0].body.ShippingDetails.Additional = {
        Geo: {
          Lng: '46.681051',
          Lat: '24.712508',
        },
      };
      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it('should not held Mana Order - worldpay order total limit', async () => {
      expect.assertions(1);
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        expect(true).toEqual(false);
        callback();
      });

      AWS.mock('SNS', 'publish', (params, callback) => {
        const { Source, Date, ...message } = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock('Lambda', 'invoke', (params,callback) => {
        callback(null, 'invoked');
      });

      axios.onGet('test-customer.com/12345678').reply(() => {
        return [200, {
          Message: {
            CashOnDeliveryApproved: true,
          },
        }];
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.ShippingDetails.Method = 'ae_cod'; // United Arab Emirates store
      orderEvent.Records[0].body.CustomerDetails.PassportID = 'test';
      orderEvent.Records[0].body.PaymentDetails.Method = 'worldpay';
      orderEvent.Records[0].body.OrderTotal = '2450.0000';
      orderEvent.Records[0].body.CurrencyCode = 'QAR';
      orderEvent.Records[0].body.ShippingDetails.Additional = {
        Geo: {
          Lng: '46.681051',
          Lat: '24.712508',
        },
      };
      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it('should not held Mana Order - COD fraud limit should deduct store credit amount', async () => {
      expect.assertions(1);
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        expect(true).toEqual(false);
        callback();
      });

      AWS.mock('SNS', 'publish', (params, callback) => {
        const { Source, Date, ...message } = JSON.parse(params.Message);
        expect(JSON.stringify(message)).toEqual('{"OperationType":"Order","From":"119-0370193-3633441","ProductId":"CLQ5708/4/58","ProductQty":-1}');
        callback();
      });

      AWS.mock('Lambda', 'invoke', (params,callback) => {
        callback(null, 'invoked');
      });

      axios.onGet('test-customer.com/12345678').reply(() => {
        return [200, {
          Message: {
            CashOnDeliveryApproved: true,
          },
        }];
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.ShippingDetails.Method = 'ae_cod'; // United Arab Emirates store
      orderEvent.Records[0].body.PaymentDetails.Method = 'COD';
      orderEvent.Records[0].body.ShippingDetails.Additional = {
        Geo: {
          Lng: '46.681051',
          Lat: '24.712508',
        },
      };
      orderEvent.Records[0].body.PaymentDetails.StoreCredit = 20;
      orderEvent.Records[0].body.CurrencyCode = 'BHD'; // 100 fraud limit
      orderEvent.Records[0].body.OrderTotal = 110;

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should not held plt automation Mana Order", async () => {
      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if (params.TableName === 'OrdersV3') {
          expect(false).toEqual(true);
        }
        callback();
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        callback();
      });

      const orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.ShippingDetails.Method = "ae_cod"; // United Arab Emirates store
      orderEvent.Records[0].body.CustomerDetails.Email = "something@pltautomation.com";

      await lambdaFunc.handler(prepareEvent(orderEvent));
    });

    it("should activate royalty", async () => {
      const fn = jest.fn();
      process.env.INVOKE_ROYALTY_STEP = 'true';

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        callback();
      });

      AWS.mock("Lambda", "invoke", (params, callback) => {
        callback(null, "invoked");
      });

      AWS.mock("SNS", "publish", (params, callback) => {
        callback();
      });

      AWS.remock("StepFunctions", "startExecution", (params, callback) => {
        fn();
        callback(null, "invoked");
      });

      const orderEvent1 = mockOrderEvent();
      orderEvent1.Records[0].body.ShippingDetails.Method = 'not_royalty';
      await lambdaFunc.handler(prepareEvent(orderEvent1));
      const orderEvent2 = mockOrderEvent();
      orderEvent2.Records[0].body.ShippingDetails.Method = 'pltshipping_pltshipping';
      await lambdaFunc.handler(prepareEvent(orderEvent2));
      const orderEvent3 = mockOrderEvent();
      orderEvent3.Records[0].body.ShippingDetails.Method = 'pltshippingus_pltshippingus';
      await lambdaFunc.handler(prepareEvent(orderEvent3));
      const orderEvent4 = mockOrderEvent();
      orderEvent4.Records[0].body.ShippingDetails.Method = 'pltshipping_cc';
      await lambdaFunc.handler(prepareEvent(orderEvent4));

      expect(fn).toBeCalledTimes(3);
    });
  });

  describe("Invalid Order: Duplicate Order Number Checker", () => {
    it("should throw an error if `OrderNumber` already exist in the Orders table and Order is not the same", async () => {
      const orderEvent = mockOrderEvent();

      AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
        if (params.TableName === "OrdersPending") {
          callback(null, { Count: 0 });
        }
      });

      OMS.Order.getByOrderNumber.mockImplementation(() => {
        return {
          OrderNumber: "119-0370193-3633441",
          Email: "test@other-domain.com",
          CustomerId: "0",
          OrderTotal: "123.00",
          QuoteId: 4,
        }
      });

      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(
        new Error("Duplicate Order Number: 119-0370193-3633441 skipped")
      );
    });

    it("should NOT throw an error if `OrderNumber` already exist in the Orders table and Order is the same (skip the processor)", async () => {
      const orderEvent = mockOrderDuplicateEvent();

      AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
        if (params.TableName === "OrdersPending") {
          callback(null, { Count: 0 });
        }
      });

      OMS.Order.getByOrderNumber.mockImplementation(() => {
        return JSON.parse(orderEvent.Records[0].body)
      });

      try {
        await lambdaFunc.handler(prepareEvent(orderEvent));
        expect(true).toBe(true);
      } catch (e) {
        expect(true).toBe(e); //shouldn't run
      }
    });
  });

  describe("Invalid Order: Validation Test", () => {
    beforeEach(() => {
      AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
        callback(null, { Count: 0 });
      });
    });

    it("should throw an error if `CustomerId` is missing", async () => {
      const orderEvent = mockOrderEvent();
      delete orderEvent.Records[0].body.CustomerDetails.CustomerId;

      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(new Error("Invalid Order: Missing CustomerId"));
    });

    it("should throw an error if `OrderCreateDate` is missing", async () => {
      const orderEvent = mockOrderEvent();
      delete orderEvent.Records[0].body.OrderCreateDate;

      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(new Error("Invalid Order: Missing OrderCreateDate"));
    });

    it("should throw an error if `OrderCreateTime` is missing", async () => {
      const orderEvent = mockOrderEvent();
      delete orderEvent.Records[0].body.OrderCreateTime;

      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(new Error("Invalid Order: Missing OrderCreateTime"));
    });

    it("should throw an error if `OrderNumber` is missing", async () => {
      const orderEvent = mockOrderEvent();
      delete orderEvent.Records[0].body.OrderNumber;

      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(new Error("Invalid Order: Missing OrderNumber"));
    });

    it("should throw an error if `IndexPostcodeLastName` is missing", async () => {
      const orderEvent = mockOrderEvent();
      delete orderEvent.Records[0].body.IndexPostcodeLastName;

      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(
        new Error("Invalid Order: Missing IndexPostcodeLastName")
      );
    });

    it("should throw an error if `Items` is missing", async () => {
      let orderEvent = mockOrderEvent();
      delete orderEvent.Records[0].body.Items;
      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(new Error("Invalid Order: Missing OrderItems"));

      orderEvent = mockOrderEvent();
      orderEvent.Records[0].body.Items = [];
      await expect(
        lambdaFunc.handler(prepareEvent(orderEvent))
      ).rejects.toEqual(new Error("Invalid Order: Missing OrderItems"));
    });
  });

  describe("Quote updates", () => {
      beforeEach(() => {
          OMS.Order.getByOrderNumber.mockImplementation(() => {
            return false
          });

          AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
            if (params.TableName === "OrdersPending") {
              callback(null, { Count: 0 });
            }
          });

          AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
              callback();
          });

          AWS.mock("Lambda", "invoke", (params,callback) => {
              callback(null, "invoked");
          });

          AWS.mock("SNS", "publish", (params, callback) => {
              callback();
          });

          AWS.mock("StepFunctions", "startExecution", (params, callback) => {
            callback(null, "invoked");
          });
      });

      it("Should not call CustomerQuotes update", async () => {
          AWS.mock("DynamoDB.DocumentClient", "update", (params, callback) => {
              expect(true).toBe(false);
              callback();
          });

          const orderEvent = mockOrderEvent();
          await lambdaFunc.handler(prepareEvent(orderEvent));
      });


  });

  describe('Eggplant', () => {
    beforeEach(() => {
      AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
        callback(null, { Count: 0 });
      });

      AWS.mock("Lambda", "invoke", (params,callback) => {
        callback(null, "invoked");
      });

      AWS.mock("DynamoDB.DocumentClient", "update", (params, callback) => {
        callback();
      });

      AWS.mock("StepFunctions", "startExecution", (params, callback) => {
        callback(null, "invoked");
      });
    });

    it('Cancel order in full', async () => {
      expect.assertions(5);

      AWS.mock("SNS", "publish", (params, callback) => {
        const msg = JSON.parse(params.Message);
        expect(msg.ProductQty).toBe(1);
        callback();
      });

      AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
        if (params.TableName == 'Refunds') {
          expect(params.Item.OrderNumber).toBe(mockOrder.Records[0].body.OrderNumber);
          expect(params.Item.Source).toBe('OMS-Eggplant');
          expect(params.Item.RefundShipping).toBe('Yes');
          expect(params.Item.OrderLines[0].ProductSku).toBe(mockOrder.Records[0].body.Items[0].Sku);
        }
        callback();
      });
      const orderEvent = prepareEvent(mockOrderEggplantEvent());

      const newOrder = JSON.parse(orderEvent.Records[0].body);
      newOrder.CustomerDetails.Email = 'something@pltautomation.com';
      orderEvent.Records[0].body = JSON.stringify(newOrder);

      await lambdaFunc.handler(orderEvent);
    });
  });
});

describe('Worldpay checks', () => {
  beforeEach(() => {
    AWS.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, SSM[params.Name]);
    });

    AWS.mock("DynamoDB.DocumentClient", "query", (params, callback) => {
      callback(null, { Count: 0 });
    });

    AWS.mock("StepFunctions", "startExecution", (params, callback) => {
      callback(null, "invoked");
    });

    process.env.LAMBDA_CONFIRMATION_EMAIL = "OMS-OrderProcessing-TriggerConfirmationEmail";
    process.env.APPLY_ROYALTY_STATE_MACHINE_ARN = "arn:....:ApplyRoyaltyStateMachine";
    process.env.NOTIFY_DMS_STATE_MACHINE_ARN = "arn:....:NotifyDMSStateMachine";
    process.env.INVOKE_INVENTORY_STEP = "true";
    process.env.WMS_INVENTORY_SNS_TOPIC = "arn:....:snsTopic";

  });
  afterEach(() => {
    AWS.restore();
  });

  it("failed", async () => {
    expect.assertions(3);
    axios.onPost(testWorldPayServer).reply(() => {
      return [200, xmlJs.js2xml(responseWorldPayFailed, {
        compact: false,
        ignoreDoctype: true,
        doctypeKey: "doctype",
        spaces: 1
      })];
    });

    AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
      expect(params.TableName).toBe("OrdersRefused");
      callback();
    });

    AWS.mock("SNS", "publish", (params, callback) => {
      expect(true).toBe(true);
      callback();
    });

    AWS.mock("Lambda", "invoke", (params,callback) => {
      expect(true).toBe(false);
      callback(null, "invoked");
    });

    const orderEvent = mockOrderEvent();
    try {
      await lambdaFunc.handler(prepareEvent(orderEvent));
      expect(true).toBe(true);
    } catch (e) {
      expect(true).toBe(false);
    }
  });

  it("REFUSED", async () => {
    axios.onPost(testWorldPayServer).reply(() => {
      return [200, xmlJs.js2xml(responseWorldPayRefused, {
        compact: false,
        ignoreDoctype: true,
        doctypeKey: "doctype",
        spaces: 1
      })];
    });

    AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
      expect(params.TableName).toBe("OrdersRefused");
      callback();
    });

    AWS.mock("SNS", "publish", (params, callback) => {
      callback();
    });

    AWS.mock("Lambda", "invoke", (params,callback) => {
      expect(true).toBe(false);
      callback(null, "invoked");
    });

    const orderEvent = mockOrderEvent();
    try {
      await lambdaFunc.handler(prepareEvent(orderEvent));
      expect(true).toBe(true);
    } catch (e) {
      console.log(e);
      expect(true).toBe(false);
    }
  });

  it("pass through - ApproximateReceiveCount reached max and Order not ready ", async () => {
    expect.assertions(3);
    axios.onPost(testWorldPayServer).reply(() => {
      return [200, xmlJs.js2xml(wpOrderNotReady, {
        compact: false,
        ignoreDoctype: true,
        doctypeKey: "doctype",
        spaces: 1
      })];
    });

    AWS.mock("SNS", "publish", (params, callback) => {
      expect(true).toBe(true);
      callback();
    });

    AWS.mock("Lambda", "invoke", (params,callback) => {
      expect(true).toBe(true);
      callback(null, "invoked");
    });

    const orderEvent = mockOrderEvent();
    orderEvent.Records[0].ApproximateReceiveCount = 3;
    try {
      await lambdaFunc.handler(prepareEvent(orderEvent));
      expect(true).toBe(true);
    } catch (e) {
      console.log("Error", e);
      expect(true).toBe(false);
    }
  });
});

function mockOrderEvent() {
  return JSON.parse(JSON.stringify(mockOrder));
}

function mockOrderEggplantEvent() {
  return JSON.parse(JSON.stringify(mockOrderForEggplant));
}

function mockOrderDuplicateEvent() {
  return JSON.parse(JSON.stringify(mockOrderDuplicate));
}

function prepareEvent(event) {
  const orderEvent = event;
  orderEvent.Records[0].body = JSON.stringify(orderEvent.Records[0].body);

  return orderEvent;
}
