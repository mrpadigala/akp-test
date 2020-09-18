
const xmlJs = require('xml-js');

const MERCHANT_CODES = {
  "1": "PLTGBP",
  "3": "PLTEUR",
  "4": "PLTEUR",
  "5": "PLTUSD",
  "6": "PLTAUD",
  "7": "PLTEUR"
};
const VALID_WORLDPAY_RESPONSES = ['CAPTURED', 'AUTHORISED', 'SETTLED_BY_MERCHANT', 'SETTLED'];
const REFUSED_WORLDPAY_RESPONSES = ['REFUSED', 'CANCELLED'];
const TIME_OUT_RESPONSE = 'REQUEST_TIMED_OUT';
const MAX_RECEIVE_COUNT = 2;

const methods = {
  getAuthorizationHeader: async (ssm, order) => {
    const parameterPath = 'oms.worldpay-refund-credentials'; //TODO are these the right credentials????
    let merchantCode = getMerchantCode(order);
    try {
      let ssmData = await
          ssm.getParameter({
            Name: parameterPath,
            WithDecryption: true
          }).promise(),
        parameterValue = JSON.parse(ssmData.Parameter.Value),
        worldPayUserName = parameterValue.Credentials['MERCHANT_' + merchantCode + '_USER'],
        worldPayUserPassword = parameterValue.Credentials['MERCHANT_' + merchantCode + '_PASS'];
      return (
        "Basic " + new Buffer.from(worldPayUserName + ":" + worldPayUserPassword).toString("base64")
      );
    } catch (err) {
      throw new Error(err.message);
    }
  },

  buildWorldpayRequest: (order) => {
    let merchantCode = getMerchantCode(order);

    let data = null;
    if (merchantCode) {
      data = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN"\n' +
        ' "http://dtd.worldpay.com/paymentService_v1.dtd">\n' +
        '<paymentService version="1.4" merchantCode="' + merchantCode + '">\n' +
        '<inquiry>\n' +
        '<orderInquiry orderCode="' + order.PaymentDetails.Id + '"/>\n' +
        '</inquiry>\n' +
        '</paymentService>';
    }
    return data;
  },

  sendWorldpayRequest: async (axios, data, auth, worldPayUrl, receiveCount) => {
    if (!worldPayUrl) {
      return Promise.reject("WorldPay url is not defined");
    }

    let options = {
      headers: {
        "Content-Type": "text/xml",
        "Authorization": auth
      },
      timeout: 10000
    };

    let worldpayResponse;
    return axios
      .post(worldPayUrl, data, options)
      .then(response => {
        try {
          worldpayResponse = xmlJs.xml2js(response.data, {
            compact: true,
            attributesKey: "attributes"
          });
        } catch (err) {
          throw new Error(err);
        }

        if (!worldpayResponse || !worldpayResponse.paymentService) {
          throw new Error('Bad worldpay object');
        }

        let worldpayResponseReply = worldpayResponse.paymentService.reply;

        if (worldpayResponseReply.error) {
          let replyError = worldpayResponseReply.error._cdata;
          if (worldpayResponseReply.error.attributes.code) {
            replyError += ` (Error Code: ${worldpayResponseReply.error.attributes.code})`;
          }
          throw new Error(replyError);
        }

        if (worldpayResponseReply &&
          worldpayResponseReply.orderStatus &&
          worldpayResponseReply.orderStatus.payment &&
          worldpayResponseReply.orderStatus.payment.lastEvent &&
          worldpayResponseReply.orderStatus.payment.lastEvent._text
        ) {
          if (
            VALID_WORLDPAY_RESPONSES.includes(worldpayResponseReply.orderStatus.payment.lastEvent._text) ||
            REFUSED_WORLDPAY_RESPONSES.includes(worldpayResponseReply.orderStatus.payment.lastEvent._text)
          ) {
            console.log(`Worldpay payment status is ${worldpayResponseReply.orderStatus.payment.lastEvent._text}`);
            return worldpayResponseReply.orderStatus.payment.lastEvent._text;
          }

          throw new Error("Worldpay response is " + worldpayResponseReply.orderStatus.payment.lastEvent._text);
        }

        if (worldpayResponseReply.orderStatus.error._cdata === 'Order not ready' && receiveCount >= MAX_RECEIVE_COUNT) {
          return "ORDER_NOT_READY";
        }

        throw new Error("Worldpay response is " + JSON.stringify(worldpayResponseReply));
      })
      .catch(err => {
        if (err.code === 'ECONNABORTED') {
          return TIME_OUT_RESPONSE;
        } else {
          throw new Error(err.message);
        }
      });
  }
};

function getMerchantCode(order) {
  if (
    order.PaymentDetails &&
    order.PaymentDetails.AdditionalInformation &&
    order.PaymentDetails.AdditionalInformation.MerchantCode
  ) {
    return order.PaymentDetails.AdditionalInformation.MerchantCode;
  }

  if (MERCHANT_CODES[order.StoreId]) {
    return MERCHANT_CODES[order.StoreId];
  }

  throw new Error("Invalid Merchant Code");
}

module.exports = methods;
