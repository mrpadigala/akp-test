"use strict";

const AWS = require("aws-sdk-mock");
const lambdaFunc = require("../index");
const order = require("./data/order");

describe("test handler", () => {
    afterEach(() => {
        AWS.restore();
    });

    it("Test successful response", async () => {
        AWS.mock("DynamoDB.DocumentClient", "scan", (params, callback) => {
          expect(params.TableName).toEqual("OrdersPending");
          if (params.TableName === "OrdersPending") {
              callback(null, {Count: 1, Items: [order]});
          }
        });

        await lambdaFunc.handler({}, null, (err, result) => {
            if (err) {
                expect(true).toBe(false);
                return;
            }

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({Count: 1, Orders: [order]});
        });
    });

    it("Test response with error", async () => {
        // //expect.assertions(3);
        let err = {
            message: "Something went wrong"
        };
        //
        AWS.mock("DynamoDB.DocumentClient", "scan", (params, callback) => {
            expect(params.TableName).toEqual("OrdersPending");
            if (params.TableName === "OrdersPending") {
              return callback(err);
            }
            callback();
        });

        try {
            await lambdaFunc.handler({}, null, (error, result) => {
                expect(result.statusCode).toBe(500);
                let body = JSON.parse(result.body);
                expect(body.error).toEqual(err.message);
            });
        } catch (e) {
            expect(e).toEqual(err);
        }
    });
});
