"use strict";

const MockAdapter = require("axios-mock-adapter");
const mockAxios = new MockAdapter(require("axios"));
const lambdaFunc = require("../index");
const AWS = require("aws-sdk-mock");

const magentoRoyaltyEndpoint = 'localhost.dev/royalty_endpoint';

describe("API calls", () => {
    beforeEach(() => {
        process.env.API_ENDPOINT = magentoRoyaltyEndpoint;
    });

    it("API call successful - add royalty", async () => {
        let customerId = "100000000";

        mockAxios.onPost(magentoRoyaltyEndpoint).reply(config => {
            expect(JSON.parse(config.data)).toEqual({
                "customer": customerId,
                "operation": "add",
                "store": 1
            });

            return [200, {}];
        });

        let result = await lambdaFunc.handler({"CustomerId": customerId, "StoreId": 1, 'Operation': 'add'});

        expect(result).toEqual(true);
    });

    it("API call successful - default operation value(add royalty)", async () => {
        let customerId = "100000000";

        mockAxios.onPost(magentoRoyaltyEndpoint).reply(config => {
            expect(JSON.parse(config.data)).toEqual({
                "customer": customerId,
                "operation": "add",
                "store": 1
            });

            return [200, {}];
        });

        let result = await lambdaFunc.handler({"CustomerId": customerId, "StoreId": 1});

        expect(result).toEqual(true);
    });

    it("API call successful - remove royalty", async () => {
        let customerId = "100000000";

        mockAxios.onPost(magentoRoyaltyEndpoint).reply(config => {
            expect(JSON.parse(config.data)).toEqual({
                "customer": customerId,
                "operation": "rm",
                "store": 1
            });

            return [200, {}];
        });

        let result = await lambdaFunc.handler({"CustomerId": customerId, "StoreId": 1, 'Operation': 'rm'});

        expect(result).toEqual(true);
    });

    it("API call failed - axios error", async () => {
        mockAxios.onPost(magentoRoyaltyEndpoint).reply(config => {
            return [401, {'message': 'Error'}];
        });

        try {
            await lambdaFunc.handler({"CustomerId": '999999', "StoreId": 1});
            expect(1).toEqual(0);
        } catch (e) {
            expect(e.message).toEqual(expect.stringMatching(/^Error:(.*)/));
        }
    });

    it("API call failed - customer id is not found", async () => {
        try {
            await lambdaFunc.handler({});
            expect(1).toEqual(0);
        } catch (e) {
            expect(e.message).toEqual("Customer Id is missing");
        }
    });
});
describe("SNS calls", () => {
   it("Publish to SNS", async () => {
       process.env.SNS_TOPIC_ROYALTY_SNS = "arn:...OMS-Royalty";
       process.env.INVOKE_MAGENTO_ROYALTY_SNS = "true";

       AWS.mock("SNS", "publish", (params, callback) => {
           expect(JSON.parse(params.Message)).toEqual({
               "CustomerId": "100000000",
               "Operation": "add",
               "OrderNumber": "1111",
               "StartDate": "2019-06-11 11:11:11",
               "StoreId": 1,
               "CustomerUuid": "12345678"
           });
           callback();
       });

       let result = await lambdaFunc.handler({
           "CustomerId": "100000000",
           "StoreId": 1,
           'Operation': 'add',
           "OrderNumber": "1111",
           "StartDate": "2019-06-11 11:11:11",
           "CustomerUuid": "12345678"
       });
       expect(result).toEqual(true);
   })
});