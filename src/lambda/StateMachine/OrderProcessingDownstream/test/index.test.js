const AWS = require("aws-sdk-mock");

jest.mock(
    "plt-layer",
    () => {
        return {
            OMS: {
                Order: {
                    getById: jest.fn(),
                    updateOrder: jest.fn(),
                }
            }
        };
    },
    { virtual: true }
);
const { OMS } = require('plt-layer');

const lambdaFunc = require("../index");
const order = require("./data/order");
const ccOrder = require("./data/cc_order");

process.env.SNS_TOPIC_WMS_CREATE_ORDER = 'WMS';
process.env.sns_topic_order_create_exclude_wms = "Sage";
process.env.WMS_INVENTORY_SNS_TOPIC = "Inventory";
process.env.MENA_ORDER_SAGE_ONLY = "true";

  describe("Click and Collect payload tests", () => {
    afterEach(() => {
      AWS.restore();
    });

    it('WMS getting click and collect payload', async () => {
        expect.assertions(1);
        OMS.Order.getById.mockImplementation(() => {
            return ccOrder;
        });

        AWS.mock("SNS", "publish", (params, callback) => {
            if (params.TopicArn === 'WMS') {
                const data = JSON.parse(params.Message);
                expect(data.OrderAttributes).toMatchObject({ParcelShopID: "ccIDexternal"});
            }
            callback();
        });
            
        await lambdaFunc.handler({OrderId: "119-0370193-3633441"});
    });

    it('WMS NOT getting click and collect payload', async () => {
        expect.assertions(1);
        OMS.Order.getById.mockImplementation(() => {
            return order;
        });

        AWS.mock("SNS", "publish", (params, callback) => {
            if (params.TopicArn === 'WMS') {
                const data = JSON.parse(params.Message);
                expect(data.OrderAttributes).not.toMatchObject({ParcelShopID: "ccIDexternal"});
            }
            callback();
    });
            
        await lambdaFunc.handler({OrderId: "119-0370193-3633441"});
    });

    it('should publish message to Sage only for Mena Order', async () => {
        expect.assertions(1);
        const menaOrder = mockOrder(order);
        menaOrder.ShippingDetails.Method = "ae_cod";
  
        OMS.Order.getById.mockImplementation(() => {
            return menaOrder;
        });
  
        AWS.mock("SNS", "publish", (params, callback) => {
            if (params.TopicArn === 'Sage') {
                const data = JSON.parse(params.Message);
                expect(data.OrderAttributes).not.toMatchObject({ParcelShopID: "ccIDexternal"});
            }
            callback();
        });
  
        await lambdaFunc.handler({OrderId: "119-0370193-3633441"});
    });

    it('should return the value of "COD" for SettlementMethod, if the order is a CoD order', async () => {
        expect.assertions(2);

        const codOrder = mockOrder(order);
        codOrder.PaymentDetails.Method = 'COD';

        OMS.Order.getById.mockImplementation(() => {
            return codOrder;
        });

        AWS.mock("SNS", "publish", (params, callback) => {
            if (params.TopicArn === 'Sage') {
                const data = JSON.parse(params.Message);
                expect(data.PaymentDetails.SettlementMethod).toBe("COD");
                expect(data.OrderAttributes).not.toMatchObject({ParcelShopID: "ccIDexternal"});
            }
            callback();
    });
            
        await lambdaFunc.handler({OrderId: "119-0370193-3633441"});
    });

    it('should not break if PaymentDetails is missing', async () => {
        expect.assertions(2);

        const codOrder = mockOrder(order);
        codOrder.PaymentDetails = undefined;

        OMS.Order.getById.mockImplementation(() => {
            return codOrder;
        });

        AWS.mock("SNS", "publish", (params, callback) => {
            if (params.TopicArn === 'Sage') {
                const data = JSON.parse(params.Message);
                expect(data.PaymentDetails.SettlementMethod).toBe("");
                expect(data.OrderAttributes).not.toMatchObject({ParcelShopID: "ccIDexternal"});
            }
            callback();
    });
            
        await lambdaFunc.handler({OrderId: "119-0370193-3633441"});
    });
});

function mockOrder(order) {
    return JSON.parse(JSON.stringify(order));
}