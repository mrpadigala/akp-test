"use strict";

const AWS = require("aws-sdk-mock");
const lambdaFunc = require("../index");

describe("test handler", () => {
  afterEach(() => {
    AWS.restore();
  });

  it("Good event", async () => {
    AWS.mock("StorageGateway", "refreshCache", (params, callback) => {
      expect(params.FileShareARN).toBe('arn:aws:storagegateway:eu-west-1:339088465693:share/12345');
      callback();
    });

    AWS.mock('STS','assumeRole',(params,callback) => {
      callback();
    });

    try {
      lambdaFunc.handler({FileShareId: "12345"});
    } catch (e) {
      expect(true).toBe(false);
    }
  });

  it("Bad event", async () => {
    try {
      lambdaFunc.handler({});
    } catch (e) {
      expect(e).toBe(new Error("Missing FileShareARN"));
    }
  });
});
