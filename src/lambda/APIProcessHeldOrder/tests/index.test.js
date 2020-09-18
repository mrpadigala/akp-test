'use strict';

const AWS = require('aws-sdk-mock');

jest.mock(
    "plt-layer",
    () => {
        return {
            OMS: {
                Order: {
                    getByOrderNumber: jest.fn(),
                    createOrder: jest.fn(),
                    updateOrder: jest.fn(),
                }
            }
        };
    },
    { virtual: true }
);

const lambdaFunc = require('../index');
const order = require("./__mocks__/order.json");

describe('Lambda function `APIProcessHeldOrder` test', () => {

    beforeEach(() => {
      process.env.WMS_INVENTORY_SNS_TOPIC = 'is_sns_topic';
      process.env.ORDER_PROCESSOR_STATE_MACHINE_ARN = "arn:....:OrderProcessorStateMachine";
      AWS.mock("StepFunctions", "startExecution", (params, callback) => {
        callback(null, "invoked");
      });
    });

    afterEach(() => {
        AWS.restore();
    });

    it("should uphold pending order", async () => {
        let awsExpects = {
            getPendingOrder: false,
            putOrder: false,
            putOrderLog: false,
            deletePendingOrder: false
        };

        const eventBody = {
            'action': 'uphold',
            'orderid': '07845ae6-7620-4aef-837a-33914aa9ab56',
            'user': 'Eric Puk',
            'userid': 345
        };

        const { OMS } = require('plt-layer');
        OMS.Order.updateOrder.mockImplementation((id, params) => {
            expect(id).toBe(eventBody.orderid);
            expect(params).toEqual({FraudCheckApproved: 'true'});
            awsExpects.putOrder = true;
            return true;
        });

        AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
            if (params.TableName === "OrdersPending") {
                awsExpects.getPendingOrder = true;
                awsExpects.fraudCheckApproved = true;
                callback(null, {Count: 1, Item: order});
            }
        });

        AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
            if (params.Item.FraudCheckApproved === 'true') {
                awsExpects.fraudCheckApproved = true;
            }

            if (params.Item.FraudCheckApproved === 'true') {
                awsExpects.fraudCheckApproved = true;
            }

            if (params.TableName === 'OrdersLogs') {
                awsExpects.putOrderLog = true;
            }

            callback(null, {Count: 1});
        });

        AWS.mock("DynamoDB.DocumentClient", "delete", (params, callback) => {
            awsExpects.deletePendingOrder = true;
            callback(null, {Count: 1});
        });

        let result = await lambdaFunc.handler({
            body: eventBody
        }, {}, (code, body) => { return body; });

        expect(awsExpects.getPendingOrder).toEqual(true);
        expect(awsExpects.putOrder).toEqual(true);
        expect(awsExpects.putOrderLog).toEqual(true);
        expect(awsExpects.deletePendingOrder).toEqual(true);
        expect(awsExpects.fraudCheckApproved).toEqual(true);

        expect(result.body).toEqual(`{"message":"Order upheld after fraud checks"}`);
    });

    it("should cancel pending order after fraud checks", async () => {
        let awsExpects = {
            getPendingOrder: false,
            putOrder: false,
            putOrderLog: false,
            deletePendingOrder: false,
            putRefund: false
        };

        const eventBody = {
            'action': 'cancel',
            'orderid': '07845ae6-7620-4aef-837a-33914aa9ab56',
            'user': 'Eric Puk',
            'userid': 345
        };

        AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
            if (params.TableName === "OrdersPending") {
                awsExpects.getPendingOrder = true;
                callback(null, {Count: 1, Item: order});
            }
        });

        const { OMS } = require('plt-layer');

        OMS.Order.updateOrder.mockImplementation((id, params) => {
            if (params.FraudCheckApproved) {
                expect(id).toBe(eventBody.orderid);
                expect(params).toEqual({FraudCheckApproved: 'cancelled'});
            }

            if (params.OrderStatus) {
                expect(id).toBe(eventBody.orderid);
                expect(params).toEqual({OrderStatus: 'Cancelled - Fraud Check'});
            }
            awsExpects.putOrder = true;
            return true;
        });

        AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
            if (params.TableName === 'OrdersLogs') {
                awsExpects.putOrderLog = true;
            }

            if (params.TableName === 'Refunds') {
                awsExpects.putRefund = true;
            }

            callback(null, {Count: 1});
        });

        AWS.mock("DynamoDB.DocumentClient", "delete", (params, callback) => {
            awsExpects.deletePendingOrder = true;
            callback(null, {Count: 1});
        });

        let result = await lambdaFunc.handler({
            'body': eventBody
        }, {}, (code, body) => { return body; });

        expect(awsExpects.getPendingOrder).toEqual(true);
        expect(awsExpects.putOrder).toEqual(true);
        expect(awsExpects.putOrderLog).toEqual(true);
        expect(awsExpects.deletePendingOrder).toEqual(true);
        expect(awsExpects.putRefund).toEqual(true);

        expect(result.body).toEqual(`{"message":"Order cancelled after fraud checks"}`);
    });

    it("should return error response when event action is missing", async () => {
        let result = await lambdaFunc.handler({
            'body': {
                'orderid': '07845ae6-7620-4aef-837a-33914aa9ab56',
                'user': 'Eric Puk',
                'userid': 345
            }
        }, {}, (code, body) => { return body; });

        expect(result.body).toEqual(`{"error":"event action is missing"}`);
    });

    it("should return error response when cannot find pending order by OrderId", async () => {
        AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => {
            if (params.TableName === "OrdersPending") {
                callback(null, {Count: 0});
            }
        });

        let upholdResult = await lambdaFunc.handler({
            body: {
                'action': 'uphold',
                'orderid': '07845ae6-7620-4aef-837a-33914aa9ab56',
                'user': 'Eric Puk',
                'userid': 345
            }
        }, {}, (code, body) => { return body; });
        expect(upholdResult.body).toEqual(`{"error":"Error: Pending Order not found"}`);

        try {
            let cancelResult = await lambdaFunc.handler({
                body: {
                    'action': 'cancel',
                    'orderid': '07845ae6-7620-4aef-837a-33914aa9ab56',
                    'user': 'Eric Puk',
                    'userid': 345
                }
            }, {}, (code, body) => {
                return body;
            });
        } catch (e) {
            expect(e).toEqual(new Error('Error: Pending Order not found'));
        }

    });

    it("should add to OrdersLogs table userId fields", async () => {
        let queryContainEmptyUserFields = false;
        AWS.mock("DynamoDB.DocumentClient", "get", (params, callback) => { callback(null, {Count: 1, Item: order}); });
        AWS.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
            if (params.TableName === 'OrdersLogs') {
                if (params.Item.User.length === 0 && params.Item.UserId.length === 0) {
                    queryContainEmptyUserFields = true;
                }
            }
            callback(null, {Count: 1});
        });
        AWS.mock("DynamoDB.DocumentClient", "delete", (params, callback) => { callback(null, {Count: 1}); });

        const { OMS } = require('plt-layer');

        OMS.Order.updateOrder.mockImplementation(() => {});

        await lambdaFunc.handler({
            body: {
                'action': 'uphold',
                'orderid': '07845ae6-7620-4aef-837a-33914aa9ab56'
            }
        }, {}, (code, body) => { return body; });

        expect(queryContainEmptyUserFields).toEqual(true);
    });

});
