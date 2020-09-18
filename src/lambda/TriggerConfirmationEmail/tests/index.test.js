/* eslint-disable */
'use strict';

const AWS = require('aws-sdk-mock');

jest.mock(
    "plt-layer",
    () => {
      return {
        OMS: {
          Order: {
            getById: jest.fn(),
          }
        }
      };
    },
    { virtual: true }
);
const { OMS } = require('plt-layer');

const lambdaFunc = require('../index');
const order = require('./data/order');
const orderWithCashOnDelivery = require('./data/orderWithCashOnDelivery');
const orderWithStoreCredit = require('./data/orderWithStoreCredit');
const orderWithDiscount = require('./data/orderWithDiscount');
const orderUS = require('./data/orderUS');
const reOrder = require('./data/re-order');
const orderWithNexusTax = require('./data/orderWithNexusTax');
const expectedMessage = require('./data/expectedMessage');
const expectedNexusMessage = require('./data/expectedNexusMessage');
const expectedReOrderMessage = require('./data/expectedReOrderMessage');
const expectedWithoutShippingDetailsMessage = require('./data/expectedWithoutShippingDetailsMessage');
const orderFRWithRoyaltyOnly = require('./data/orderFRWithRoyaltyOnly');

const event = {
  OrderId: 'order-id',
  TableName: 'Orders',
};

const eventOrdersPending = {
  OrderId: 'order-id',
  TableName: 'OrdersPending',
};

const {
  describe, beforeEach, afterEach, it, expect,
} = global;



describe('test handler', () => {
  afterEach(() => {
    AWS.restore();
  });

  beforeEach(() => {
    process.env.SQS_QUEUE_URL = 'PLT-ScheduledEmail-Emarsys';
    AWS.mock('SSM', 'getParameter', (params, callback) => {
      callback(null, { Parameter: { Value: 0 } });
    });
  });

  it('Positive - email message correct', async () => {
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody)).toEqual(expectedMessage);
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      return order;
    });

    await lambdaFunc.handler(event);
  });

  it('Positive - email message correct (via OrdersPending table)', async () => {
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody)).toEqual(expectedMessage);
      callback();
    });

    AWS.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      if (params.TableName === 'OrdersPending') {
        callback(null, { Count: 1, Item: order });
      }
    });

    await lambdaFunc.handler(eventOrdersPending);
  });

  it('Positive - nexus tax - email message correct', async () => {
    let isMessageSent = false;
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody)).toEqual(expectedNexusMessage);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      return orderWithNexusTax;
    });

    await lambdaFunc.handler(event);
    expect(isMessageSent).toEqual(true);
  });

  it('Shipment email - is royalty', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.isRoyalty).toEqual(true);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const correctRoyaltyOrder = JSON.parse(JSON.stringify(order));
      const start = new Date();
      const end = new Date();

      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() + 1);

      correctRoyaltyOrder.CustomerDetails.Royalty = {
        royaltyExpiry: formatRoyaltyDate(end),
        royaltyStart: formatRoyaltyDate(start),
      };

      return correctRoyaltyOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test discount', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].discountPercentage).toEqual(20);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      return orderWithDiscount;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it("Test event ids", async () => {
    // store event id map
    const testMap = [
      { storeId: 1, eventId: 6786 }, // PRETTYLITTLETHING
      { storeId: 4, eventId: 6786 }, // EU
      { storeId: 3, eventId: 7359 }, // IRE
      { storeId: 5, eventId: 6342 }, // US
      { storeId: 6, eventId: 7352 }, // AU
      { storeId: 7, eventId: 7353 }, // FR
      { storeId: 8, eventId: 8316 }, // CA
      { storeId: 9, eventId: 8317 }, // IL
      { storeId: 'Wrong', eventId: 6786 }, // Default
    ];

    for (const testCase of testMap) {
      let isMessageSent = false;

      AWS.mock("SQS", "sendMessage", (params, callback) => {
        expect(JSON.parse(params.MessageBody).event_id).toEqual(testCase.eventId);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        let newOrder = JSON.parse(JSON.stringify(order));

        newOrder.StoreId = testCase.storeId;
        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);

      AWS.restore("SQS");
    }
  });

  it('Test empty ProductOptions', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.Items[0].ProductOptions = JSON.stringify({});

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test is not exist ProductOptions', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      delete newOrder.Items[0].ProductOptions;

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test empty attributes_info', async () => {
    let isMessageSent = false;
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.Items[0].ProductOptions = JSON.stringify({ attributes_info: [] });

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test attributes_info without correct size labels', async () => {
    let isMessageSent = false;
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.Items[0].ProductOptions = JSON.stringify({
        attributes_info: [{
          label: 'Wrong label',
          value: '10',
        }],
      });

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test attributes_info json parse error', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.Items[0].ProductOptions = 'attributes_info';
      
      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test when attributes_info is object', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual('10');
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.Items[0].ProductOptions = { attributes_info: [{ label: 'Size', value: '10' }] };

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test FR price', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.paymentDetails.orderSubtotal).toEqual('148,00');
      expect(message.data.paymentDetails.shippingCost).toEqual('20,00');
      expect(message.data.paymentDetails.orderTotal).toEqual('168,00');
      expect(message.data.productData[0].Price).toEqual('70,00');
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.StoreId = '7';

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test FR date format', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.estimatedDeliveryDate).toEqual('Mercredi 5 Décembre');
      expect(message.data.requestedDeliveryDate).toEqual('Mercredi 5 Décembre');
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.StoreId = '7';

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test unexpected currency symbol', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.baseCurrencySymbol).toEqual('New Code');
      isMessageSent = true;
      callback();
    });

    AWS.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      if (params.TableName === 'Orders') {
        const newOrder = JSON.parse(JSON.stringify(order));

        newOrder.CurrencyCode = 'New Code';

        callback(null, { Item: newOrder, Count: 1 });
      }
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.CurrencyCode = 'New Code';

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test delivery address', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.deliveryAddress.line1).toEqual('Line2');
      expect(message.data.deliveryAddress.line2).toEqual('Line4');
      expect(message.data.deliveryAddress.line3).toEqual(null);
      expect(message.data.deliveryAddress.line4).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.ShippingDetails.Address.Street = null;
      newOrder.ShippingDetails.Address.Postcode = 'Line2';
      newOrder.ShippingDetails.Address.City = null;
      newOrder.ShippingDetails.Address.CountryCode = 'Line4';

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test without shipping details', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody)).toEqual(expectedWithoutShippingDetailsMessage);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      delete newOrder.ShippingDetails;

      newOrder.OrderTotal = '148.0000';

     return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test with empty EstimatedDeliveryDate', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.estimatedDeliveryDate).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      delete newOrder.EstimatedDeliveryDate;

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test with empty RequestedDeliveryDate', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.requestedDeliveryDate).toEqual(null);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      delete newOrder.RequestedDeliveryDate;

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('Test royalty without customer details', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.isRoyalty).toEqual(false);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      delete newOrder.CustomerDetails.Royalty;

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it("Test royalty for UK/CAN/EUR stores and currency is not GBP", async () => {
    // is royalty test cases
    let testMap = [
      {
        "storeId": "1", // PRETTYLITTLETHING
        "expectRoyalty": false,
        "currencyCode": "GBP"
      },
      {
        "storeId": "1", // PRETTYLITTLETHING
        "expectRoyalty": true,
        "currencyCode": "EUR"
      },
      {
        "storeId": "4", // EU
        "expectRoyalty": true,
        "currencyCode": "EUR"
      },
      {
        "storeId": "4", // EU
        "expectRoyalty": false,
        "currencyCode": "GBP"
      },
      {
        "storeId": "5", // US
        "expectRoyalty": false,
        "currencyCode": "EUR"
      },
      {
        "storeId": "5", // US
        "expectRoyalty": false,
        "currencyCode": "GBP"
      }
    ];

    for (const testCase of testMap) {
      let isMessageSent = false;

      AWS.mock("SQS", "sendMessage", (params, callback) => {
        let message = JSON.parse(params.MessageBody);
        expect(message.data.isRoyalty).toEqual(testCase.expectRoyalty);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        let newOrder = JSON.parse(JSON.stringify(order));

        newOrder.StoreId = testCase.storeId;
        newOrder.CurrencyCode = testCase.currencyCode;

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);

      AWS.restore("SQS");
    }
  });

  it('Test discount coupon', async () => {
    let isMessageSent = false;
    const discountCode = 'jadore40';

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      const message = JSON.parse(params.MessageBody);

      expect(message.data.discountCode).toEqual(discountCode);
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      const newOrder = JSON.parse(JSON.stringify(order));

      newOrder.DiscountCode = discountCode;

      return newOrder;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  it('DB error fetching order', async () => {
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      throw new Error('Error')
    });

    await expect(lambdaFunc.handler(event)).rejects.toThrow('Error');
  });

  it('DB order not found', async () => {
    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      return false;
    });

    await expect(lambdaFunc.handler(event)).rejects.toThrow(/Order not found/);
  });

  it('Event parameters is not correct', async () => {
    await expect(lambdaFunc.handler({})).rejects.toThrow(/^Event parameters is not correct!(.*)/);
  });

  it('Test shipping with only royalty item and FR colour|size', async () => {
    let isMessageSent = false;

    AWS.mock('SQS', 'sendMessage', (params, callback) => {
      expect(JSON.parse(params.MessageBody).data.paymentDetails.shippingMethod).toEqual('Shipping');
      expect(JSON.parse(params.MessageBody).data.paymentDetails.shippingCost).toEqual('0.00');
      expect(JSON.parse(params.MessageBody).data.productData[0].Colour).toEqual('noire');
      expect(JSON.parse(params.MessageBody).data.productData[0].Size).toEqual('20');
      isMessageSent = true;
      callback();
    });

    OMS.Order.getById.mockImplementation(() => {
      return orderFRWithRoyaltyOnly;
    });

    await lambdaFunc.handler(event);

    expect(isMessageSent).toEqual(true);
  });

  describe('Test USA Sales Tax', () => {
    it('Test - contains sales tax', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody).data.paymentDetails.salesTax).toEqual('24.67');
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        return orderUS;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - contains sales tax - UK store id', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody).data.paymentDetails.salesTax).toEqual('24.67');
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(orderUS));
        newOrder.StoreId = '1';

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - contain sales tax - without code', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody).data.paymentDetails.salesTax).toEqual('24.67');
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(orderUS));

        newOrder.OrderTax[0].Code = null;

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - doesn\'t contain sales tax - zero sales tax', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody).data.paymentDetails.salesTax === undefined).toEqual(true);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(orderUS));

        newOrder.OrderTax[0].Amount = '0.0000';

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - doesn\'t contain sales tax - UK code', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        if (JSON.parse(params.MessageBody).data.paymentDetails.salesTax) {
          expect(1).toEqual(2);
        }
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(orderUS));

        newOrder.OrderTax[0].Code = 'UK code';

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - doesn\'t contain sales tax - without tax amount', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody).data.paymentDetails.salesTax === undefined).toEqual(true);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(orderUS));

        newOrder.OrderTax[0].Amount = null;

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });
  });

  describe('Test re-order message', () => {
    it('Test - email message correct', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        expect(JSON.parse(params.MessageBody)).toEqual(expectedReOrderMessage);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        return reOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - without shipping', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);
        expect(typeof message.data.paymentDetails.shippingMethod === 'undefined').toEqual(true);
        expect(typeof message.data.paymentDetails.shippingCost === 'undefined').toEqual(true);
        expect(typeof message.data.deliveryAddress === 'undefined').toEqual(true);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(reOrder));
        delete newOrder.ShippingDetails;


        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });

    it('Test - without sales tax', async () => {
      let isMessageSent = false;

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);
        expect(typeof message.data.paymentDetails.salesTax === 'undefined').toEqual(true);
        isMessageSent = true;
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        const newOrder = JSON.parse(JSON.stringify(reOrder));
        newOrder.OrderTax[0].Code = 'UK';

        return newOrder;
      });

      await lambdaFunc.handler(event);

      expect(isMessageSent).toEqual(true);
    });
  });

  describe('Test peak communications', () => {

    it('should attach peakcomms flag when enabled in ssm', async () => {
      AWS.restore('SSM');
      AWS.mock('SSM', 'getParameter', (params, callback) => {
        callback(null, { Parameter: { Value: 1 } });
      });

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);
        expect(message.data.peakcomms).toEqual(true);
        callback();
      });

      await lambdaFunc.handler(event);
    });

    it('should not attach peakcomms flg when disabled in ssm', async () => {
      AWS.restore('SSM');
      AWS.mock('SSM', 'getParameter', (params, callback) => {
        callback(null, { Parameter: { Value: 0 } });
      });

      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);
        expect(typeof message.data.peakcomms).toEqual("undefined");
        callback();
      });

      await lambdaFunc.handler(event);
    });

    it('should attach cash on delivery details', async () => {
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);
        expect(message.data.paymentDetails.cashOnDelivery).toBeTruthy();
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        return orderWithCashOnDelivery;
      });

      await lambdaFunc.handler(event);
    });

    it('should attach store credit details', async () => {
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);
        expect(message.data.paymentDetails.storeCredit).toBe("9.99");
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        return orderWithStoreCredit;
      });

      await lambdaFunc.handler(event);
    });

  });

  describe('Test Store Credit', () => {
    it('should reduce Order Total if a customer have a store credit', async () => {
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);

        expect(message.data.paymentDetails.orderTotal).toBe("158.01");
        expect(message.data.paymentDetails.cashOnDeliveryTotal).toBe("158.01");
        callback();
      });

      OMS.Order.getById.mockImplementation(() => {
        return orderWithStoreCredit;
      });

      await lambdaFunc.handler(event);
    });

    it('should set Order Total to 0 if customer have enough credit (no remaining to pay)', async () => {
      AWS.mock('SQS', 'sendMessage', (params, callback) => {
        const message = JSON.parse(params.MessageBody);

        expect(message.data.paymentDetails.orderTotal).toBe("0.00");
        expect(message.data.paymentDetails.cashOnDeliveryTotal).toBe("0.00");
        callback();
      });

      const order = clone(orderWithStoreCredit);
      order.PaymentDetails.StoreCredit = 500;

      OMS.Order.getById.mockImplementation(() => {
        return order;
      });

      await lambdaFunc.handler(event);
    });
  });
});

/**
 * @param date Date
 * @returns {string}
 */
function formatRoyaltyDate(date) {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getUTCSeconds()}`;
}

function clone(object) {
  return JSON.parse(JSON.stringify(object));
}