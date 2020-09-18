'use strict';

let AWS = require("aws-sdk");
const moment = require('moment');
if (process.env.NODE_ENV !== "test") {
    const AWSXRay = require("aws-xray-sdk");
    AWS = AWSXRay.captureAWS(AWS);
}

const { SsmClient }  = require('../common/client/SsmClient');
const { validate }  = require('./validator');
const { getOrderNumber } = require('../common/UnallocatedOrderNumber-Get');

const {
    getProductionInformationBySku,
    InvalidRequestError,
    ProductNotFoundError
} = require('../common/ProductService/ProductService');

const DEFAULT_STORE_ID = "1";
const DEFAULT_ORDER_STATUS = "processing"

const cacheSsm = { productServiceApiKey: null };

exports.handler = async function(event) {
    const SQS = new AWS.SQS();

    try {
        const body = typeof event.body === "object" ? event.body : JSON.parse(event.body);

        let validationErrors = validate(body);

        if (validationErrors.length > 0) {
            return buildResponse(422, {
                'Message': 'Validation error',
                'Errors': validationErrors
            });
        }

        let message = await buildMessage(body);
        await publishToSQS(SQS, message);

        return buildResponse(200, {
            'OrderNumber': message.OrderNumber
        });
    } catch (err) {
        console.error(err);

        if (err instanceof SkuNotFoundError) {
            return buildResponse(422, {
                'Message': 'Invalid SKU',
                'Errors': err.message.split(",")
            });
        }

        return buildResponse(500, {
            'Message': 'Server error',
            'Errors': [err.message]
        });
    }
};

async function publishToSQS(SQS, message) {
    const params = {
        MessageBody: JSON.stringify(message),
        QueueUrl: process.env.SQS_QUEUE_URL
    };

    return SQS.sendMessage(params).promise();
}

async function buildMessage(request) {
    let order = JSON.parse(JSON.stringify(request));

    let date = moment();
    let items = await getItems(mergeDuplicateLines(request.Items));
    let storeId = request.StoreId ? request.StoreId: DEFAULT_STORE_ID;

    const orderNumberResponse = await getOrderNumber();

    order.CustomerUuid = request.CustomerUuid ? request.CustomerUuid : '0';
    order.DeviceType = request.DeviceType ? request.DeviceType : null;
    order.AgentData = request.AgentData ? request.AgentData : null;
    order.OrderCreateDate = date.format("YYYY-MM-DD");
    order.OrderDate = date.format("YYYY-MM-DD HH:mm:ss");
    order.OrderCreateTime = parseInt(date.format("X"));
    order.OrderNumber = `${storeId}${orderNumberResponse.OrderNumber}`;
    order.IndexPostcodeLastName = getIndexPostcodeLastName(request);
    order.EstimatedDeliveryDate = request.EstimatedDeliveryDate ? request.EstimatedDeliveryDate: null;
    order.RequestedDeliveryDate = request.RequestedDeliveryDate ? request.RequestedDeliveryDate: null;
    order.DiscountCode = request.DiscountCode ? request.DiscountCode: null;
    order.DiscountCouponDescription = request.DiscountCouponDescription ? request.DiscountCouponDescription: null;
    order.StoreId = storeId;
    order.StoreName = request.StoreName? request.StoreName : getStoreName(storeId);
    order.Domain = request.Domain? request.Domain : getStoreName(storeId);
    order.CustomerDetails = getOrderCustomerDetails(request.CustomerDetails);
    order.BillingDetails = getOrderBillingDetails(order.BillingDetails);
    order.ShippingDetails = getOrderShippingDetails(order.ShippingDetails);
    order.Items = items;
    order.OrderTotalDetails = getOrderTotalDetails(request, items);
    order.OrderTotal = order.OrderTotalDetails.Paid;
    order.TaxAmount = formatPrice(getOrderTaxAmount(items));
    order.OrderStatus = DEFAULT_ORDER_STATUS;
    order.OrderSource = request.OrderSource? request.OrderSource : 'API Order';
    order.PaymentDetails = request.OrderSource === 'Re-order' && request.PaymentDetails ? request.PaymentDetails : {};

    return order;
}

function getStoreName(storeId) {
    const STORE_NAME = {
        "1": "prettylittlething.com",
        "3": "prettylittlething.ie",
        "5": "prettylittlething.us",
        "6": "prettylittlething.com.au",
        "7": "prettylittlething.fr",
        "8": "prettylittlething.ca",
        "9": "prettylittlething.co.il",
        "10": "prettylittlething.qa",
        "11": "prettylittlething.bh",
        "12": "prettylittlething.jo",
        "13": "prettylittlething.com.kw",
        "14": "prettylittlething.om",
        "15": "prettylittlething.sa",
        "16": "prettylittlething.ae",
    }
    
    if (STORE_NAME[storeId]) {
        return STORE_NAME[storeId];
    }

    return "Unknown Store Name";
}

function getIndexPostcodeLastName(request) {
    let indexPostcodeLastName = request.BillingDetails.Address.Postcode +
        request.CustomerDetails.LastName;

    indexPostcodeLastName = indexPostcodeLastName.replace(/\s/g, '');
    indexPostcodeLastName = indexPostcodeLastName.toLowerCase();

    return indexPostcodeLastName;
}

function mergeDuplicateLines(requestItems) {
  let mergedItems = {};
  let items = [];
  let mergeFields = [
    'BaseDiscount',
    'BaseTaxAmount',
    'Discount',
    'TaxAmount',
    'Quantity',
  ];

  requestItems.forEach(function(item) {
    if(mergedItems[item.Sku] === undefined) {
      mergedItems[item.Sku] = item;
    } else {
      const existItem = mergedItems[item.Sku];

      mergeFields.forEach(function (field) {
        if(existItem[field] !== undefined && item[field] !== undefined) {
          existItem[field] = Number((item[field] + existItem[field]).toFixed(2));

        }
      });
    }
  });

  for(const key in mergedItems) {
    items.push(mergedItems[key]);
  }

  return items;
}

async function getItems(requestItems) {
    let orderItems = [];
    requestItems = await mapMissingFieldsFromPIM(requestItems);

    requestItems.forEach(function(item) {
        let orderItem = JSON.parse(JSON.stringify(item));

        let rowTotal = item.Price ? item.Quantity * item.Price: 0;
        let rowTotalInclTax = item.OriginalPrice ? item.Quantity * item.OriginalPrice: 0;
        let rowTotalActual = rowTotalInclTax ? rowTotalInclTax - (item.Discount ? item.Discount: 0): 0;
        let rowTotalActualInclTax = rowTotalInclTax ? rowTotalInclTax - (item.Discount ? item.Discount: 0): 0;
        let baseRowTotal = item.BasePrice ? item.Quantity * item.BasePrice: rowTotal;
        let baseRowTotalInclTax = item.BaseOriginalPrice ? item.Quantity * item.BaseOriginalPrice: rowTotalInclTax;

        orderItem.BaseDiscount = formatPrice(item.BaseDiscount ? item.BaseDiscount: item.Discount),
        orderItem.BaseOriginalPrice = formatPrice(item.BaseOriginalPrice ? item.BaseOriginalPrice: item.OriginalPrice),
        orderItem.BasePrice =  formatPrice(item.BasePrice ? item.BasePrice: item.Price),
        orderItem.BaseRowTotal =  formatPrice(baseRowTotal),
        orderItem.BaseRowTotalInclTax =  formatPrice(baseRowTotalInclTax),
        orderItem.BaseTaxAmount = formatPrice(item.BaseTaxAmount ? item.BaseTaxAmount: item.TaxAmount),
        orderItem.Discount = formatPrice(item.Discount),
        orderItem.Image = item.Image ? item.Image: null,
        orderItem.OriginalPrice = formatPrice(item.OriginalPrice),
        orderItem.Price = formatPrice(item.Price),
        orderItem.ProductOptions = item.SelectedValues ? generateProductOptions(item.SelectedValues) : '{}',
        orderItem.SelectedValues = item.SelectedValues ? item.SelectedValues : [],
        orderItem.ProductType = item.ProductType ? item.ProductType: 'simple',
        orderItem.Quantity = formatNumbers(item.Quantity),
        orderItem.RowTotal = formatPrice(rowTotal),
        orderItem.RowTotalActual = rowTotalActual,
        orderItem.RowTotalActualInclTax = rowTotalActualInclTax,
        orderItem.RowTotalInclTax = formatPrice(rowTotalInclTax),
        orderItem.Size = item.Size ? item.Size: null,
        orderItem.TaxAmount = formatPrice(item.TaxAmount),
        orderItem.TaxPercent = formatNumbers(item.TaxPercent)

        orderItems.push(orderItem);
    });

    return orderItems;
}

function getOrderCustomerDetails(requestCustomerDetails) {
    let orderCustomerDetails = JSON.parse(JSON.stringify(requestCustomerDetails));

    orderCustomerDetails.CustomerId = requestCustomerDetails.CustomerId ? requestCustomerDetails.CustomerId : "0";
    orderCustomerDetails.Type = orderCustomerDetails.CustomerId !== "0" ? "Registered": "Guest";
    orderCustomerDetails.GroupId = orderCustomerDetails.GroupId? orderCustomerDetails.GroupId : "0";

    return orderCustomerDetails;
}

function getOrderBillingDetails(requestBillingDetails) {
    let orderBillingDetails = JSON.parse(JSON.stringify(requestBillingDetails));

    orderBillingDetails.Address.Region = requestBillingDetails.Address.Region ? requestBillingDetails.Address.Region: null;

    return orderBillingDetails;
}

function getOrderShippingDetails(requestShippingDetails) {
    let orderShippingDetails = JSON.parse(JSON.stringify(requestShippingDetails));

    orderShippingDetails.Address.Region = requestShippingDetails.Address.Region ? requestShippingDetails.Address.Region: null;
    orderShippingDetails.BasePrice = formatPrice(requestShippingDetails.BasePrice ? requestShippingDetails.BasePrice: requestShippingDetails.Price);
    orderShippingDetails.Price = formatPrice(requestShippingDetails.Price);
    orderShippingDetails.DiscountAmount = formatPrice(requestShippingDetails.DiscountAmount);

    return orderShippingDetails;
}

function getOrderTotalDetails(request, items) {
    let orderDiscount = 0;
    let orderOriginalShipping = request.ShippingDetails.Price ? request.ShippingDetails.Price: 0;
    let orderShipping = request.ShippingDetails.Price ? request.ShippingDetails.Price: 0;
    let orderSubtotal = 0;
    let orderTaxAmount = 0;

    items.forEach(function(item) {
        orderDiscount += parseFloat(item.Discount);
        orderTaxAmount += parseFloat(item.TaxAmount);
        orderSubtotal += parseFloat(item.RowTotalActual);
    });

    let orderPaid = orderSubtotal + orderShipping;
    orderSubtotal -= orderTaxAmount;

    return {
        "Discount": formatPrice(orderDiscount),
        "OriginalShipping": parseFloat(orderOriginalShipping),
        "Shipping": formatPrice(orderShipping),
        "Paid": formatPrice(orderPaid),
        "Subtotal": formatPrice(orderSubtotal)
    };
}

async function mapMissingFieldsFromPIM(items) {
    const requiredFields = [
        'Price',
        'OriginalPrice',
        'Name'
    ];

    let missingFieldsSkus = items.reduce(function(accumulator, item) {
        for(const field of requiredFields) {
            if (!item.hasOwnProperty(field) || item[field] === undefined) { 
                accumulator.push(item.Sku);
                break;
            }
        }

        return accumulator;
    }, []);
    
    if (missingFieldsSkus.length > 0) {
        let productInfoResponse;
        try {
            if (cacheSsm.productServiceApiKey === null) {
                const ssmClient = new SsmClient(new AWS.SSM());
                cacheSsm.productServiceApiKey = await ssmClient.get(process.env.PRODUCT_SERVICE_KEY_SSM_PARAM);
            }
            productInfoResponse = await getProductionInformationBySku(missingFieldsSkus, cacheSsm.productServiceApiKey);
        } catch (err) {
            if (err instanceof InvalidRequestError || err instanceof ProductNotFoundError) {
                throw new SkuNotFoundError(missingFieldsSkus.join(", "))
            }

            throw err;
        }

        if (productInfoResponse.MissingSku && productInfoResponse.MissingSku.length > 0) {
            throw new SkuNotFoundError(productInfoResponse.MissingSku.join(", "))
        }

        for(const productInfo of productInfoResponse.Products) {
            let orderItem = items.find(item => item.Sku.trim() == productInfo.Sku.trim());

            if (!orderItem.hasOwnProperty("Name") || orderItem.Name === undefined) {
                orderItem.Name = productInfo.Name
            }

            if (!orderItem.hasOwnProperty("Price") || orderItem.Price === undefined) {
                orderItem.Price = productInfo.OriginalPrice
            }

            if (!orderItem.hasOwnProperty("OriginalPrice") || orderItem.OriginalPrice === undefined) {
                orderItem.OriginalPrice = productInfo.SpecialPrice !== false? productInfo.SpecialPrice : productInfo.OriginalPrice
            }

            if (!orderItem.hasOwnProperty("SelectedValues") || orderItem.SelectedValues === undefined) {
                orderItem.SelectedValues = productInfo.Options
            }

            if (!orderItem.hasOwnProperty("Image") || orderItem.Image === undefined) {
                orderItem.Image = productInfo.Image
            }
        }
    }

    return items;
}

function formatPrice(price) {
    return formatNumbers(price);
}

function formatNumbers(number) {
    if(number) {
        return Number(number).toFixed(4);
    }

    return "0.0000";
}

function getOrderTaxAmount(items) {
    let orderTaxAmount = 0;

    items.forEach(function(item) {
        orderTaxAmount += parseFloat(item.TaxAmount);
    });

    return orderTaxAmount;
}

function generateProductOptions(selectedValues) {
    if (selectedValues.length <= 0) {
        return "{}";
    }

    let options = [];

    for(const selected of selectedValues) {
        if (selected.label && selected.value) {
            options.push({
                "label": selected.label,
                "value":  selected.value,
            });
        }
    }

    return JSON.stringify({"attributes_info": options});
}

function buildResponse(code, body) {
    if (code !== 200) {
        console.error(body);
    }

    return {
        statusCode: code,
        body: JSON.stringify(body)
    };
}

class SkuNotFoundError extends Error {
    constructor(message) {
      super(message)
      this.name = 'SkuNotFoundError'
      this.message = message
    }
}
