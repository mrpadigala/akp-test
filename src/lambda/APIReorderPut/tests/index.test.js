'use strict';

const AWS = require('aws-sdk-mock');

jest.mock(
    "plt-layer",
    () => {
        return {
            OMS: {
                Order: {
                    getById: jest.fn(),
                    updateOrderlineStatus: jest.fn(),
                    updateOrder: jest.fn(),
                }
            }
        };
    },
    { virtual: true }
);
const { OMS } = require("plt-layer");

const lambdaFunc = require('../index');
const reorderRequest = require("./__mocks__/putReorderRequest.json");
const parentOrder = require("./__mocks__/parentOrder.json");
var oldDate = Date;

describe('Lambda function `APIReorderPUT` test', () => {

    beforeEach(() => {
        process.env.LAMBDA_ORDER_PUT = "API-Order-PUT";
        Date = function (fake) {
            return new oldDate('2019-03-29 14:29:13.141');
        }
    });

    afterEach(() => {
        AWS.restore();
        Date = oldDate;
    });

    it("should create reorder entry", async () => {
        //Invoke APIReorderPUT Lambda Mock
        AWS.mock("Lambda", "invoke", (params,callback) => {
            expect(params.FunctionName).toEqual(process.env.LAMBDA_ORDER_PUT);
            expect(params.Payload).toEqual(JSON.stringify(reorderRequest));
            callback(null, {
                StatusCode: 200,
                Payload: JSON.stringify({body:JSON.stringify({OrderNumber: "12345"})})
            });
        });

        OMS.Order.getById.mockImplementation(() => parentOrder);

        let result = await lambdaFunc.handler(reorderRequest);

        expect(result).toEqual({"body": JSON.stringify({OrderNumber: "12345"}), "statusCode": 200});
        expect(OMS.Order.getById).toHaveBeenCalledWith("bc87ae3f-bba7-4e35-9c20-26aef8e5eda6");
        expect(OMS.Order.updateOrderlineStatus).toHaveBeenCalledWith(
          "bc87ae3f-bba7-4e35-9c20-26aef8e5eda6",
          [
            { index: 0, value: { Qty: 1, Status: "Reordered", OrderNumber: "12345" } },
            { index: 1, value: { Qty: 1, Status: "Reordered", OrderNumber: "12345" } }
          ]
        );
        expect(OMS.Order.updateOrder).toHaveBeenCalledWith(
          "bc87ae3f-bba7-4e35-9c20-26aef8e5eda6",
          {
            Reordered: "true"
          }
        );

        // 2 expects - invoke APIReorderPUT lambda,
        // 1 expect  - get parent order
        // 2 expects - update parent order items statuses and reordered status (one item not existing in the parent order should be skipped) 
        // 1 expect  - verify response
        expect.assertions(6);
    });

    it("should return exception when can't create re-order entry", async () => {

        //Invoke APIReorderPUT Lambda Mock
        AWS.mock("Lambda", "invoke", (params,callback) => {
            callback(null, {
                StatusCode: 500,
                Payload: JSON.stringify({body:{"message": "error 1"}})
            });
        });

        let result = await lambdaFunc.handler(reorderRequest);

        console.log(result);
        expect(result.statusCode).toEqual(500);
        expect(result.body).toEqual('"Error: {\\"StatusCode\\":500,\\"Payload\\":\\"{\\\\\\"body\\\\\\":{\\\\\\"message\\\\\\":\\\\\\"error 1\\\\\\"}}\\"}"');
    });

    it("should throw an error if parent order is not found", async () => {
        OMS.Order.getById.mockImplementation(() => {
            return false;
        });

        let result = await lambdaFunc.handler(reorderRequest);
        expect(result.statusCode).toEqual(500);
        expect(result.body).toMatch(/Error: Parent Order not found. Parent Order Number: bc87ae3f-bba7-4e35-9c20-26aef8e5eda6/);
        expect(OMS.Order.getById).toHaveBeenCalledWith("bc87ae3f-bba7-4e35-9c20-26aef8e5eda6")
        expect.assertions(3);
    });

});
