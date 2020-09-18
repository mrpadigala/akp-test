"use strict";

const MockAdapter = require("axios-mock-adapter");
const mockAxios = new MockAdapter(require("axios"));
const lambdaFunc = require("../index");

const API_ENDPOINT ="https://xxxxx.execute-api.eu-west-1.amazonaws.com/Staging";
const API_KEY = "1234567aaaaa";

const orderNumber = "123-456-789";
const discountCode = "code50PercentOff";
const customerId = "1";

describe("Notify DMS - Discount Used", () => {
  beforeEach(() => {
    process.env.API_ENDPOINT = API_ENDPOINT;
    process.env.API_KEY = API_KEY;
  });

  it("should successfully send used Discount Code to DMS via API", async () => {
    const url = `${API_ENDPOINT}/coupon/${discountCode}/use/${orderNumber}/${customerId}`;

    mockAxios.onPut(url).reply(config => {
      expect(config.url).toEqual(url);
      expect(config.headers["x-api-key"]).toEqual(API_KEY);

      return [200, {}];
    });

    let result = await lambdaFunc.handler({
      DiscountCode: discountCode,
      OrderNumber: orderNumber,
      CustomerId: customerId,
    });

    expect(result).toEqual(true);
  });

  it("should throw an error if DMS responded with error", async () => {
    const url = `${API_ENDPOINT}/coupon/${discountCode}/use/${orderNumber}/${customerId}`;

    mockAxios.onPut(url).reply(config => {
      return [422, { error: 'Error: Coupon not found' }];
    });

    await expect(
        lambdaFunc.handler({
            DiscountCode: discountCode,
            OrderNumber: orderNumber,
            CustomerId: customerId,
        })
      ).rejects.toThrow("Error: Coupon not found (Status Code: 422)");
  });

  it("should throw an error if DMS network is down or return status code 500", async () => {
    const url = `${API_ENDPOINT}/coupon/${discountCode}/use/${orderNumber}/${customerId}`;

    mockAxios.onPut(url).reply(config => {
        return [500, { message: "Error" }];
    });

    await expect(
        lambdaFunc.handler({
            DiscountCode: discountCode,
            OrderNumber: orderNumber,
            CustomerId: customerId,
        })
      ).rejects.toThrow("Request failed with status code 500");
  });


  it("should throw an error if DiscountCode is missing from the event", async () => {
      await expect(
        lambdaFunc.handler({
            OrderNumber: orderNumber
        })
      ).rejects.toThrow("DiscountCode is missing");
  });

  it("should throw an error if OrderNumber is missing from the event", async () => {
      await expect(
        lambdaFunc.handler({
            DiscountCode: discountCode
        })
      ).rejects.toThrow("OrderNumber is missing");
  });

  it("should throw an error if CustomerId is missing from the event", async () => {
      await expect(
        lambdaFunc.handler({
            DiscountCode: discountCode,
            OrderNumber: orderNumber,
        })
      ).rejects.toThrow("CustomerId is missing");
  });
});
