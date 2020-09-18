'use strict';

let AWS = require('aws-sdk');

if (process.env.NODE_ENV !== 'test') {
  const AWSXRay = require('aws-xray-sdk');
  AWS = AWSXRay.captureAWS(AWS);
}
const { OMS }  = require("plt-layer");
const moment = require('moment');
let ssm;

exports.handler = async (event) => {
  const SQS = new AWS.SQS();
  const DOC_CLIENT = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });
  ssm = new AWS.SSM();

  // Countries Store Id
  const STORE_PRETTYLITTLETHING = '1';
  const EU_STORE_ID = '4';
  const IRE_STORE_ID = '3';
  const US_STORE_ID = '5';
  const AU_STORE_ID = '6';
  const FR_STORE_ID = '7';
  const CA_STORE_ID = '8';
  const IL_STORE_ID = '9';
  const QA_STORE_ID = '10';
  const BH_STORE_ID = '11';
  const JO_STORE_ID = '12';
  const KW_STORE_ID = '13';
  const OM_STORE_ID = '14';
  const SA_STORE_ID = '15';
  const AE_STORE_ID = '16';

  try {
    if (!event.OrderId || !event.TableName) {
      throw new Error('Event parameters is not correct!');
    }

    const orderId = event.OrderId;
    const tableName = event.TableName;
    const order = await getOrder(orderId, tableName);

    await publishEmailToSQS(await buildEmailMessage(order));
  } catch (e) {
    throw e;
  }

  return true;

  async function publishEmailToSQS(message) {
    const params = {
      MessageBody: JSON.stringify(message),
      QueueUrl: process.env.SQS_QUEUE_URL,
    };

    return SQS.sendMessage(params).promise();
  }

  /**
     * Get order by order number.
     *
     * @param orderId
     * @param tableName
     * @returns {Promise<*>}
     */
  async function getOrder(orderId, tableName) {
    if (tableName === "Orders") {
      const order = await OMS.Order.getById(orderId);

      if (!order) {
        throw new Error(`Order not found ${orderId}`);
      }

      return order;
    }

    const order = await DOC_CLIENT
      .get({
        TableName: tableName,
        Key: {
          OrderId: orderId,
        },
      }).promise();

    if (!order.Item || order.Item.length < 1) {
      throw new Error(`Order not found ${orderId}`);
    }

    return order.Item;
  }

  async function buildEmailMessage(order) {
    const orderStoreId = order.StoreId;
    const emarsysMessage = {
      key_id: '3', // todo
      event_id: getEventId(orderStoreId),
      external_id: order.CustomerDetails.Email,
      data: {
        orderNo: order.OrderNumber,
        baseCurrencySymbol: getCurrencySymbol(order.CurrencyCode),
        customerDetails: {
          firstName: order.CustomerDetails.FirstName,
          lastName: order.CustomerDetails.LastName,
        },
        isRoyalty: isRoyalty(order),
        paymentDetails: {
          orderTotal: formatPrice(getOrderTotalRemaining(order), orderStoreId),
          orderSubtotal: formatPrice(calculateSubtotal(order.Items), orderStoreId),
          discount: formatPrice(order.OrderTotalDetails.Discount, orderStoreId),
          storeCredit: getStoreCredit(order),
          cashOnDelivery: hasCashOnDelivery(order),
          cashOnDeliveryTotal: formatPrice(getCashOnDeliveryTotal(order), orderStoreId),
        },
        discountCode: order.DiscountCode ? order.DiscountCode : null,
        estimatedDeliveryDate: order.EstimatedDeliveryDate
          ? formatDate(order.EstimatedDeliveryDate, orderStoreId) : null,
        requestedDeliveryDate: order.RequestedDeliveryDate
          ? formatDate(order.RequestedDeliveryDate, orderStoreId) : null,
        productData: getProductData(order.Items, orderStoreId),
        domain: order.Domain ? order.Domain : null,
      },
    };

    if (order.ShippingDetails) {
      emarsysMessage.data.paymentDetails.shippingMethod = order.ShippingDetails.Type ? order.ShippingDetails.Type : 'Shipping';
      emarsysMessage.data.paymentDetails.shippingCost = formatPrice(order.ShippingDetails.OriginalShipping
        ? order.ShippingDetails.OriginalShipping : 0, orderStoreId);
      emarsysMessage.data.deliveryAddress = getDeliveryAddress(order);

      if (order.ShippingDetails.Address && order.ShippingDetails.Address.CountryCode) {
        emarsysMessage.data.shippingCountryCode = order.ShippingDetails.Address.CountryCode;
      }
    }

    const salesTax = getSalesTax(order);

    if (salesTax !== null) {
      emarsysMessage.data.paymentDetails.salesTax = formatPrice(salesTax, orderStoreId);
    }

    if (isReorder(order)) {
      reorderMiddleware(emarsysMessage, orderStoreId);
    }

    if (await isPeakCommsActive()) {
      emarsysMessage.data.peakcomms = true;
    }

    return emarsysMessage;
  }

  function reorderMiddleware(message, orderStoreId) {
    message.data.paymentDetails.orderTotal = formatPrice(0, orderStoreId);
    message.data.paymentDetails.cashOnDeliveryTotal = formatPrice(0, orderStoreId);
    message.data.paymentDetails.orderSubtotal = formatPrice(0, orderStoreId);

    if (message.data.paymentDetails.shippingCost) {
      message.data.paymentDetails.shippingCost = formatPrice(0, orderStoreId);
    }

    if (typeof message.data.paymentDetails.salesTax !== 'undefined') {
      message.data.paymentDetails.salesTax = formatPrice(0, orderStoreId);
    }

    message.data.productData.map((item) => {
      item.discountPrice = formatPrice(0, orderStoreId);
      item.discountPercentage = 100;
      return item;
    });

    return message;
  }

  function isReorder(order) {
    return !!order.ParentOrderId;
  }

  function getProductData(items, orderStoreId) {
    return items.map((item) => {
      const itemPrice = calculateItemPrice(item);
      const result = {
        Image: item.Image,
        Description: item.Name,
        Size: item.ProductOptions ? getSize(item.ProductOptions) : null,
        Colour: item.ProductOptions ? getColour(item.ProductOptions) : null,
        Price: formatPrice(itemPrice, orderStoreId),
        QTY: parseInt(item.Quantity).toString(),
      };

      if (parseFloat(item.Discount)) {
        result.discountPrice = formatPrice(itemPrice - parseFloat(item.Discount), orderStoreId);
        result.discountPercentage = getPercentageDiscount(item);
      }

      return result;
    });
  }

  function calculateItemPrice(item) {
    let price = parseFloat(item.RowTotalInclTax);

    if(item.SalesTax) {
      price -= parseFloat(item.SalesTax);
    }

    return price;
  }

  function getDeliveryAddress(order) {
    const addresses = [];
    const deliveryAddress = {};

    ['Street', 'City', 'Postcode', 'CountryCode'].forEach((value) => {
      const addressLine = order.ShippingDetails.Address[value];
      if (addressLine) {
        addresses.push(addressLine);
      }
    });

    for (let i = 1; i <= 4; i++) {
      deliveryAddress[`line${i}`] = addresses[i - 1] ? addresses[i - 1] : null;
    }

    return deliveryAddress;
  }

  function getColour(productOptions) {
    const labels = [
      'Colour',
      'Couleur',
      'Color'
    ];

    return getAttributesValue(productOptions, labels);
  }

  function getSize(productOptions) {
    const labels = [
      'Size',
      'Taille',
    ];

    return getAttributesValue(productOptions, labels);
  }

  function getAttributesValue(productOptions, labels) {
    for (const label of labels) {
      const value = getAttributeValue(productOptions, label);

      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  function getAttributeValue(productOptions, name) {
    try {
      const options = typeof productOptions === 'object' ? productOptions : JSON.parse(productOptions);

      if (options.attributes_info) {
        for (const item of options.attributes_info) {
          if (item.label.trim().indexOf(name) !== -1) {
            return item.value;
          }
        }
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  function getSalesTax(order) {
    const orderTax = getOrderTax(order);
    if (orderTax) {
      const orderTaxAmount = orderTax.Amount ? parseFloat(orderTax.Amount) : null;
      const countryCode = order.ShippingDetails
        ? order.ShippingDetails.Address.CountryCode : null;

      if (
        (order.StoreId === US_STORE_ID || order.StoreId === STORE_PRETTYLITTLETHING)
        && orderTaxAmount
        && (!orderTax.Code || orderTax.Code.trim().indexOf('UK') === -1)
        && countryCode === 'US'
      ) {
        return orderTaxAmount;
      }
    }

    return null;
  }

  function getCurrencySymbol(currency) {
    const currencies = {
      AUD: 'AU$',
      EUR: '€',
      GBP: '£',
      USD: '$',
      CAD: 'CA$',
      ILS: '₪',
    };

    if (currencies[currency]) {
      return currencies[currency];
    }

    return currency;
  }

  function getEventId(orderStoreId) {
    const defaultStore = STORE_PRETTYLITTLETHING;
    const eventsMap = {};

    eventsMap[STORE_PRETTYLITTLETHING] = 6786;
    eventsMap[EU_STORE_ID] = 6786;
    eventsMap[IRE_STORE_ID] = 7359;
    eventsMap[US_STORE_ID] = 6342;
    eventsMap[AU_STORE_ID] = 7352;
    eventsMap[FR_STORE_ID] = 7353;
    eventsMap[CA_STORE_ID] = 8316;
    eventsMap[IL_STORE_ID] = 8317;
    eventsMap[QA_STORE_ID] = 8668;
    eventsMap[BH_STORE_ID] = 8668;
    eventsMap[JO_STORE_ID] = 8668;
    eventsMap[KW_STORE_ID] = 8668;
    eventsMap[OM_STORE_ID] = 8668;
    eventsMap[SA_STORE_ID] = 8668;
    eventsMap[AE_STORE_ID] = 8668;

    return eventsMap[orderStoreId]
      ? eventsMap[orderStoreId] : eventsMap[defaultStore];
  }

  function formatPrice(price, orderStoreId) {
    const float = parseFloat(price);
    let newPrice = float.toFixed(2);

    if (orderStoreId === FR_STORE_ID) {
      newPrice = newPrice.replace('.', ',');
    }

    return newPrice;
  }

  function getPercentageDiscount(orderItem) {
    return Math.round(
        (parseFloat(orderItem.Discount) / parseFloat(orderItem.Quantity))
        / parseFloat(orderItem.OriginalPrice)
        * 100
    );
  }

  function calculateSubtotal(orderItems) {
    const orderSubtotal = 0;

    return orderItems.reduce(
      (value, item) => value + calculateItemPrice(item),
      orderSubtotal,
    );
  }

  function isRoyalty(order) {
    let status = false;

    if (
      [STORE_PRETTYLITTLETHING, EU_STORE_ID].indexOf(order.StoreId) !== -1
            && order.CurrencyCode !== 'GBP'
    ) {
      return true;
    }

    if (order.CustomerDetails && order.CustomerDetails.Royalty) {
      if (
        order.CustomerDetails.Royalty.royaltyStart
                && order.CustomerDetails.Royalty.royaltyExpiry
      ) {
        const start = new Date(order.CustomerDetails.Royalty.royaltyStart);
        const end = new Date(order.CustomerDetails.Royalty.royaltyExpiry);
        const today = new Date();

        if (today > start && today < end) {
          status = true;
        }
      }
    }

    return status;
  }

  function getOrderTax(order) {
    if (order.OrderTax) {
      for (const orderTaxItem of order.OrderTax) {
        return orderTaxItem;
      }
    }
    return false;
  }

  function formatDate(dateString, storeId) {
    const date = moment(dateString);

    if (storeId !== FR_STORE_ID) {
      return date.format('dddd Do MMMM');
    }
    const frDate = date.locale('fr');
    return `${capitalize(frDate.format('dddd'))} ${frDate.format('Do')} ${capitalize(frDate.format('MMMM'))}`;
  }

  function capitalize(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  async function isPeakCommsActive() {
    let ssmData = await ssm.getParameter({
      Name: "oms.confirmation-email-peak-comms-active",
      WithDecryption: true
    }).promise();

    return parseInt(ssmData.Parameter.Value) === 1;
  }

  function getStoreCredit(order) {
    const storeCredit = parseFloat(order.PaymentDetails.StoreCredit);

    return !isNaN(storeCredit) && storeCredit > 0
      ? formatPrice(order.PaymentDetails.StoreCredit)
      : null;
  }

  function hasCashOnDelivery(order) {
    return order.PaymentDetails
        && order.PaymentDetails.Method
        && order.PaymentDetails.Method.toLowerCase() === 'cod';
  }

  function getCashOnDeliveryTotal(order) {
    if (!hasCashOnDelivery(order)) {
      return 0;
    }

    let storeCredit = getStoreCredit(order) ? parseFloat(getStoreCredit(order)) : 0;

    return Math.max(0, order.OrderTotal - storeCredit);
  }

  function getOrderTotalRemaining(order) {
    const storeCredit = getStoreCredit(order) ? parseFloat(getStoreCredit(order)) : 0;

    return Math.max(0, order.OrderTotal - storeCredit);
  }
};
