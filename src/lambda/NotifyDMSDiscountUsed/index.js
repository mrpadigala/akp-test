"use strict";

const axios = require("axios");

let API_ENDPOINT;
let API_KEY;

exports.handler = async event => {
    API_ENDPOINT = process.env.API_ENDPOINT;
    API_KEY = process.env.API_KEY;

    ['OrderNumber', 'DiscountCode', 'CustomerId'].forEach((field) => {
      if (!event[field]) {
          throw new Error (`${field} is missing`);
      }
    });

    console.log(`Order Number: ${event.OrderNumber}, Discount Code: ${event.DiscountCode}, CustomerId: ${event.CustomerId}`);

    try {
        await sendRequestToDms(event.OrderNumber, event.DiscountCode, event.CustomerId);
    } catch (err) {
        throw err;
    }

    return true;
};

async function sendRequestToDms(orderNumber, discountCode, customerId) {
    let url = `${API_ENDPOINT}/coupon/${discountCode}/use/${orderNumber}/${customerId}`;

    const config = { 
        'headers': {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        }
    };

    try {
        const response = await axios.put(url, {}, config);
        
        return response.data;
    } catch (err) {
        if (err.response && err.response.data) {
            console.error("HTTP Status Code: ", err.response.status);
            console.error("HTTP Error Message: ", err.response.data);
            if (err.response.status !== 500) {
                throw new Error(`${err.response.data.error} (Status Code: ${err.response.status})`);
            }
        }

        // Something happened that triggered an Error, eg: network error or error code 500;
        throw new DMSError(err.message);
    }
}

class DMSError extends Error {
    constructor(...args) {
        super(...args);
        Error.captureStackTrace(this, DMSError);
        this.name = "DMSError";
    }
}
