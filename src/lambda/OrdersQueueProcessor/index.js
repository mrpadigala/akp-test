const AWSXRay = require("aws-xray-sdk");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const uuidv4 = require("uuid/v4");
const axios = require("axios");
const worldpay = require("./worldpay");
const moment = require('moment-timezone');
const { OMS } = require("plt-layer");
const { mapOrderToWmsPayload } = require("../StateMachine/OrderProcessingDownstream/order_payload");
const { heldMenaOrder } = require('../common/mena');

moment.tz.setDefault('Europe/London');

const ssmCache = {};
let docClient;
let lambda;
let stepFunction;
let sns;
let ssm;

let APPLY_ROYALTY_STATE_MACHINE_ARN,
  NOTIFY_DMS_STATE_MACHINE_ARN,
  ORDER_PROCESSOR_STATE_MACHINE_ARN,
  INVOKE_ROYALTY_STEP,
  INVOKE_INVENTORY_STEP,
  INVOKE_NOTIFY_DMS_STEP,
  WMS_INVENTORY_SNS_TOPIC,
  EGGPLANT_ORDER,
  INVOKE_WORLD_PAY_CHECK,
  WORLD_PAY_URL,
  INVOKE_ORDER_PROCESSOR_STEP,
  HELD_MENA_ORDER;

const ROYALTY_SHIPPING_METHODS = ["pltshipping_pltshipping", "pltshippingus_pltshippingus", "pltshipping_cc"];
const REFUSED_TTL = 60 * 60 * 24 * 180; //180 days
const REFUSED_TYPES = ['REFUSED', 'CANCELLED'];
const TIME_OUT_RESPONSE = 'REQUEST_TIMED_OUT';

exports.handler = async event => {
  docClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
    convertEmptyValues: true
  });
  lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
  stepFunction = new AWS.StepFunctions();
  sns = new AWS.SNS();
  ssm = new AWS.SSM();

  const TABLE_ORDERS = "Orders";
  const TABLE_ORDERS_PENDING = "OrdersPending";

  APPLY_ROYALTY_STATE_MACHINE_ARN = process.env.APPLY_ROYALTY_STATE_MACHINE_ARN;
  NOTIFY_DMS_STATE_MACHINE_ARN = process.env.NOTIFY_DMS_STATE_MACHINE_ARN;
  ORDER_PROCESSOR_STATE_MACHINE_ARN = process.env.ORDER_PROCESSOR_STATE_MACHINE_ARN;

  INVOKE_ROYALTY_STEP = process.env.INVOKE_ROYALTY_STEP === 'true';
  INVOKE_INVENTORY_STEP = process.env.INVOKE_INVENTORY_STEP === 'true';
  INVOKE_NOTIFY_DMS_STEP = process.env.INVOKE_NOTIFY_DMS_STEP === 'true';
  WMS_INVENTORY_SNS_TOPIC = process.env.WMS_INVENTORY_SNS_TOPIC;
  EGGPLANT_ORDER = false;
  WORLD_PAY_URL = process.env.WORLD_PAY_URL;
  INVOKE_WORLD_PAY_CHECK = process.env.INVOKE_WORLD_PAY_CHECK === 'true';
  INVOKE_ORDER_PROCESSOR_STEP = process.env.INVOKE_ORDER_PROCESSOR_STEP === 'true';
  HELD_MENA_ORDER = process.env.HELD_MENA_ORDER === 'true';

  try {
    for (const record of event.Records) {
      const receiveCount = record.ApproximateReceiveCount;
      let order = JSON.parse(record.body);
      console.log(`-- Order Number: ${order.OrderNumber} Processing`);

      order.RawMessage = record.body;
      order.OrderId = order.OrderNumber;
      order.CustomerId = Number.isInteger(order.CustomerDetails.CustomerId)
        ? order.CustomerDetails.CustomerId.toString()
        : order.CustomerDetails.CustomerId;
      order.Email = order.CustomerDetails.Email ? order.CustomerDetails.Email.toLowerCase() : '';

      if (order.Email === '') {
        order.Email = getEmailFromPayment(order);
        order.CustomerDetails.Email = order.Email;
      }
      validateOrder(order);

      const IS_FRAUDCHECK_REQUIRED = isFraudCheckRequired(order);

      let existingOrder = await getExistingOrder(order.OrderNumber);
      if (existingOrder) {
        if (
          order.Email !== existingOrder.Email ||
          order.CustomerId !== existingOrder.CustomerId ||
          order.QuoteId !== existingOrder.QuoteId ||
          order.OrderTotal !== existingOrder.OrderTotal
        ) {
          const msg = `Duplicate Order Number: ${order.OrderNumber} skipped`;
          console.error(msg);
          throw new Error(msg);
        }

        console.log(`Duplicate Order Number: ${order.OrderNumber} skipped from DLQ`);
        continue;
      }

      if (!!order.IsTest) {
        await OMS.Order.createOrder(order);
        console.log(`${order.OrderNumber} - akamai test order saved - order number: ${order.OrderNumber}`);

        await sendTestOrderToWMS(order);
        console.log(`akamai test order sent to wms - order number: ${order.OrderNumber}`);

        continue;
      }

      if (INVOKE_WORLD_PAY_CHECK) {
        const wpResult = await checkWorldpayPayment(order, receiveCount);
        if (REFUSED_TYPES.includes(wpResult)) {
          await saveOrderRefused(order, wpResult);
          console.log(`${order.OrderNumber} ${wpResult} by Worldpay`);
          await updateInventoryService(order.OrderNumber, order.Items, 'increment');
          continue;
        } else if(wpResult === TIME_OUT_RESPONSE) {
          console.log(`${order.OrderNumber} ${wpResult} by Worldpay`);
        }

        if (wpResult === 'ORDER_NOT_READY') {
          console.log(`${order.OrderNumber} ${wpResult} by Worldpay - pass through`);
        }
      }

      let table = TABLE_ORDERS;
      if (IS_FRAUDCHECK_REQUIRED) {
        table = TABLE_ORDERS_PENDING;
        console.log(`${order.OrderNumber} - Fraudcheck required!`);
      }

      flagRoyaltyOnlyOrder(order);
      checkEggplantOrder(order);
      flagNotShippedOrder(order);

      await OMS.Order.createOrder(order);
      console.log(`${order.OrderNumber} - order saved!`);

      const onHoldReasonTypes = await getOnHoldReasonTypes(order);
      if (onHoldReasonTypes.length) {
        console.log(`${order.OrderNumber} - Mena Order`);
        await heldMenaOrder(order.OrderId, onHoldReasonTypes);
        console.log(`${order.OrderNumber} - Mena Order on Held`);

        await OMS.Log.add(order.OrderId, {
          Comment: 'Mena Order On Held',
          Type: 'Mena Order',
          User: 'OMS',
          LogData: {
            Status: 'Held',
          },
        });
      }

      if (!IS_FRAUDCHECK_REQUIRED && INVOKE_ORDER_PROCESSOR_STEP) {
        try {
          await invokeOrderProcessorStepFunction(order.OrderId);
        }  catch (e) {
          console.log(`Step function already invoked for ${order.OrderId}`,e);
        }
      }

      console.log(`${order.OrderNumber} - downstream step function executed!`);

      if (IS_FRAUDCHECK_REQUIRED) {
        await addOrderLogMessage({'orderid': order.OrderId}, "Order Pending due to fraud checks", "Fraudcheck Required");
      }

      if (INVOKE_INVENTORY_STEP && order.StockDecremented !== true) {
          await updateInventoryService(order.OrderNumber, order.Items);
        console.log(`${order.OrderNumber} - Inventory service updated!`);
      }

      await invokeLambdaOrderConfirmation(order.OrderId, table);
      console.log(`${order.OrderNumber} - Order Confirmation invoked!`);

      if (INVOKE_ROYALTY_STEP && isOrderRoyalty(order) ) {
        await invokeStepFunctionApplyRoyalty(order);
        console.log(`${order.OrderNumber} - Royalty invoked!`);
      }

      if (INVOKE_NOTIFY_DMS_STEP && isOrderDiscounted(order)) {
        await invokeStepFunctionNotifyDMS(
          order.OrderNumber,
          order.DiscountCode,
          order.CustomerId || '',
        );
        console.log(`${order.OrderNumber} - DMS notified!`);
      }

      if (EGGPLANT_ORDER) {
        if (order.StockDecremented) {
          await updateInventoryService(order.OrderNumber, order.Items, 'increment');
        }
        await createFullRefund(order);
        console.log(`${order.OrderNumber} - Full refund created!`);
      }

      if (IS_FRAUDCHECK_REQUIRED) {
        await saveOrder(order, table);
        console.log(`${order.OrderNumber} - order saved in OrdersPending table!`);
      }
    }
  } catch (err) {
    throw err;
  }
};

function isOrderRoyalty(order) {
    if (order.ShippingDetails &&
        ROYALTY_SHIPPING_METHODS.includes(order.ShippingDetails.Method) &&
        order.ShippingDetails.Price > 0
    ) {
      return true;
    }

    if (isRoyaltyShippingDiscounted(order)) {
      return true;
    }

    let royaltyOrder = order.Items.find(item => isRoyaltySku(item.Sku));

    if (typeof royaltyOrder !== 'undefined') {
      return true;
    }

    return false;
}

async function updateInventoryService(orderNumber, items, updateType) {
  const filteredItems = items.filter(
    item => ['configurable', 'simple'].indexOf(item.ProductType) !== -1
  );

  for (const item of filteredItems) {
    const message = buildInventoryMessage(orderNumber, item, updateType);
    await sendInventoryMessage(message);
    console.log("Stock updated",message);
  }
}

function buildInventoryMessage(orderNumber, item, updateType) {
  const now = new Date();
  return {
    "OperationType": "Order",
    "From": `${orderNumber}`,
    "ProductId": item.Sku,
    "ProductQty": updateType === 'increment' ? parseInt(item.Quantity) : -parseInt(item.Quantity),
    "Source": "OMS-Queue-Processor",
    "Date": now.toISOString()
  };
}

function sendInventoryMessage(message) {
    let params = {
        Message: JSON.stringify(message),
        TopicArn: WMS_INVENTORY_SNS_TOPIC
    };

    return sns.publish(params).promise();
}

async function getExistingOrder(orderNumber) {
  const pendingOrder = await getOrdersPending(orderNumber);
  if (pendingOrder.Count > 0) {
    return pendingOrder.Items[0];
  }

  return await OMS.Order.getByOrderNumber(orderNumber);
}

function getOrdersPending(orderNumber) {
  const params = {
    TableName: "OrdersPending",
    IndexName: "OrderNumber-index",
    KeyConditionExpression: "OrderNumber = :on",
    ExpressionAttributeValues: {
      ":on": orderNumber
    }
  };

  return docClient.query(params).promise();
}

function validateOrder(order) {
  const requiredFields = [
    "CustomerId",
    "Email",
    "IndexPostcodeLastName",
    "OrderCreateDate",
    "OrderCreateTime",
    "OrderNumber"
  ];

  const missingField = requiredFields.find(
    field =>
      order[field] === "" || order[field] === null || order[field] === undefined
  );

  if (missingField) {
    throw new Error(`Invalid Order: Missing ${missingField}`);
  }

  if (!order.Items || !Array.isArray(order.Items) || order.Items.length === 0) {
    throw new Error(`Invalid Order: Missing OrderItems`);
  }
}

function saveOrder(order, tableName) {
  const params = {
    TableName: tableName,
    ConditionExpression: "#OrderNumber <> :orderNumber",
    ExpressionAttributeNames: {
      "#OrderNumber": "OrderNumber"
    },
    ExpressionAttributeValues: {
      ":orderNumber": order.OrderNumber
    },
    Item: order
  };

  return docClient.put(params).promise();
}

function isBlacklistedPostcode(order) {
  const codes = [
    '84116-1832',
    '10469-3041',
    '21201-4434',
    '02540-2942',
    '10467-8842',
    '11233-4069',
    '22003-3532',
    '02860-3757',
    '10475-4138',
    '49684-2243',
    '10469-3057',
    '22306-3286',
    '90068-2401',
    '92627-3906',
    '92627-3907',
    '10030-3553',
    '10451-5218',
    '10473-4005',
    '11223-4503',
    '11225-3239',
    '11236-5119',
    '19352-9141',
    '19711-5434',
    '21702-4057',
    '28150-5957',
    '29323-9177',
    '38118-4439',
    '43229-6806',
    '48219-1334',
    '48227-1849',
    '77069-3448',
    '10451-5221',
    '01605-3900',
    '43220-2316',
    '07003-3615',
    '33166-6216',
    '33166',
    '10462-6128',
    '92394-9536',
    '29582-7610',
    '33172-9111',
    '07064-1602',
    '27526-6901',
    '68521-2049',
    '95062-3246',
    '77066-1609',
    '37086-2562',
    '10466-3736',
    '44119-1652',
    '17104-3439',
    '10452-6448',
    '26508-8068',
    '56560-7922',
    '08701-7238',
    '65806-3396',
    '11798-2020',
    '97305-1053',
    '30017-1618',
    '16117-4005',
    '32714-1638',
    '33172-2422'
  ];

  return (
    (order.ShippingDetails && order.ShippingDetails.Address && codes.includes(order.ShippingDetails.Address.Postcode)) ||
    (order.BillingDetails && order.BillingDetails.Address && codes.includes(order.BillingDetails.Address.Postcode))
  );
}


function isFraudCheckRequired(order) {
  if (isMenaCustomerServiceScreeningRequired(order)) {
    return false;
  }

  if (isBlackListedEmail(order)) {
    return true;
  }

  if (isBlacklistedPostcode(order)) {
    return true;
  }

  if (isFreePayment(order)) {
    return true;
  }

  return isOverThresholdValue(order, 'STANDARD');
}

function isOverThresholdValue(order, orderType) {
  const HOLD_ORDER = {
    STANDARD: {
      GBP: 500,
      EUR: 565,
      AUD: 850,
      USD: 650,
      CAD: 850,
      NZD: 950,
      ILS: 2200,
      QAR: 2500,
      BHD: 250,
      JOD: 450,
      KWD: 200,
      OMR: 250,
      SAR: 2500,
      AED: 2500,
    },
    MENA_COD: {
      GBP: 500,
      EUR: 565,
      AUD: 850,
      USD: 650,
      CAD: 850,
      NZD: 950,
      ILS: 2200,
      QAR: 950,
      BHD: 100,
      JOD: 180,
      KWD: 80,
      OMR: 100,
      SAR: 1000,
      AED: 950,
    },
  };

  const fraudCheckAmount = HOLD_ORDER[orderType][order.CurrencyCode];

  if (!fraudCheckAmount) {
    throw new Error('Matching CurrencyCode is not found for fraud check');
  }
  let orderTotal = Number(order.OrderTotal);

  if (orderType === 'MENA_COD' && order.PaymentDetails.StoreCredit) {
    orderTotal -= order.PaymentDetails.StoreCredit;
  }

  return orderTotal >= fraudCheckAmount;
}

function invokeLambdaOrderConfirmation(orderId, tableName) {
  const params = {
    FunctionName: process.env.LAMBDA_CONFIRMATION_EMAIL,
    InvocationType: "Event",
    Payload: JSON.stringify({
      OrderId: orderId,
      TableName: tableName
    })
  };

  return lambda.invoke(params).promise();
}

function invokeStepFunctionApplyRoyalty(order) {
    const name = `Customer-${order.CustomerId}-Time-${new Date().getTime()}`;
    const params = {
        stateMachineArn: APPLY_ROYALTY_STATE_MACHINE_ARN,
        input: JSON.stringify({
          CustomerId: order.CustomerId,
          StoreId: order.StoreId,
          OrderNumber: order.OrderNumber,
          StartDate: order.OrderDate,
          ExecutionId: name,
          CustomerUuid:  order.CustomerUuid,
         }),
        name: name
    };

    return stepFunction.startExecution(params).promise();
}

function invokeStepFunctionNotifyDMS(orderNumber, discountCode, customerId) {
  const name = `OrderNumber-${orderNumber}-Time-${new Date().getTime()}`;
  const params = {
      stateMachineArn: NOTIFY_DMS_STATE_MACHINE_ARN,
      input: JSON.stringify({ OrderNumber: orderNumber, DiscountCode: discountCode, ExecutionId: name, CustomerId: customerId }),
      name: name
  };

  return stepFunction.startExecution(params).promise();
}

function invokeOrderProcessorStepFunction(orderId) {
  const params = {
    stateMachineArn: ORDER_PROCESSOR_STATE_MACHINE_ARN,
    input: JSON.stringify({ OrderId: orderId}),
    name: `OrderNumber-${orderId}`
  };

  return stepFunction.startExecution(params).promise();
}

async function flagRoyaltyOnlyOrder(order) {
  if (order.Items.length === 1 && isRoyaltySku(order.Items[0].Sku)) {
    order.RoyaltyOnly = 'true';
    await addRoyaltyOnlyReport(order.OrderId);
  }
}

function addRoyaltyOnlyReport(orderId) {
  const now = moment();
  const item = {
    EntityId: 'order',
    EntityType: `royaltyOnly#${now.format('YYYY-MM-DD-HH-mm')}#${now.format('x')}`,
    Data: {
      OrderNumber: orderId,
    },
    CreatedAt: now.format('x'),
    TTL: now.clone().add(3, 'months').format('X'),
  };

  return docClient
    .put({
      TableName: 'Reports',
      Item: item,
    })
    .promise();
}

function checkEggplantOrder(order) {
  if (isAutomatedOrder(order)) {
    order.OrderStatus = "Cancelled - Eggplant";
    EGGPLANT_ORDER = true;
  }
}

function flagNotShippedOrder(order) {
  order.NotShipped =`${order.ShippingDetails.Method}-${moment(order.OrderDate).format('YYYY-MM-DD')}`;
}

function createFullRefund(order) {
  //insert refund entry in Refunds table
  const date = new Date();
  const oid = `EGGPLANT-OID-${order.OrderNumber}-${Math.floor(Math.random() * 99)}`;
  const updateParams = {
    TableName: "Refunds",
    ReturnConsumedCapacity: "TOTAL",
    Item: {
      Id: uuidv4(),
      RefundId: oid,
      OrderNumber: isReorder(order) ? order.ParentOrderNumber : order.OrderNumber,
      FromReorder: isReorder(order) ? order.OrderNumber : null,
      PaymentMethod: order.PaymentDetails.Method,
      RefundType: '1',
      RefundShipping: 'Yes',
      Source: 'OMS-Eggplant',
      OrderLines: getOrderlinesFromRefunded(order.Items,oid),
      IsException: 'false',
      IsProcessed: 'Pending',
      CreatedAt: date.getTime(),
      SourceRequest: "Eggplant",
      RefundedAt: 0
    }
  };

  return docClient.put(updateParams).promise();
}

function isReorder(order) {
  return !!order.ParentOrderId;
}

function getOrderlinesFromRefunded(items, oid) {
  return items.map( item => {
    return {
      "Data": oid,
      "KeyTable": null,
      "LineTotal": calculateLineTotalRefunded(item).toFixed(5),
      "ProductSku": item.Sku,
      "Quantity": parseFloat(item.Quantity).toFixed(5)
    }
  });
}

function calculateLineTotalRefunded(item) {
  return item.RowTotalActualInclTax ?
    item.RowTotalActualInclTax : (typeof item.RowTotalActual === 'undefined') ?
      (item.RowTotalInclTax - item.Discount) : item.RowTotalActual;
}

function isOrderDiscounted(order) {
  if (order.DiscountCode) {
    return true;
  }

  return false;
}

async function checkWorldpayPayment(order, receiveCount) {
  if (
    order &&
    order.PaymentDetails &&
    order.PaymentDetails.Method &&
    order.PaymentDetails.Method.toLowerCase().indexOf('worldpay') !== -1) {
    console.log("Worldpay check " + order.OrderNumber);

    const auth = await worldpay.getAuthorizationHeader(ssm, order);
    const wpData = worldpay.buildWorldpayRequest(order);
    return worldpay.sendWorldpayRequest(axios, wpData, auth, WORLD_PAY_URL, receiveCount);
  }
}

function isBlackListedEmail(order) {
  const BLACKLIST_ORDER = [
    "@yopmail"
  ];

  for (block of BLACKLIST_ORDER) {
      if (order.Email.includes(block)) {
          return true;
      }
  }

  return false
}

function isFreePayment(order) {
  if (
    order.PaymentDetails &&
    order.PaymentDetails.AdditionalInformation &&
    order.PaymentDetails.AdditionalInformation.PaymentMethod === 'free-payment' &&
    !order.Email.includes('@prettylittlething.com')
  ) {
    return true;
  }
  return false;
}

function saveOrderRefused(order, status) {
  const expiryDate = Math.floor(Date.now() / 1000) + REFUSED_TTL;
  const params = {
    TableName: "OrdersRefused",
    Item: {
      OrderNumber: order.OrderNumber,
      Status: status,
      Data: order.RawMessage,
      DateCreated: Date.now(),
      DayCreated: moment().format("YYYY-MM-DD"),
      ExpiryDate: expiryDate
    }
  };

  return docClient.put(params).promise();
}

async function addOrderLogMessage(event, comment, type) {
  let logItem = {
    TableName: "OrdersLogs",
    Item: {
      Comment: comment,
      CreatedAt: new Date().toISOString(),
      Id: uuidv4(),
      OrderId: event.orderid,
      Type: type,
      User: event.user || 'System',
      UserId: event.userid || ''
    }
  };

  return docClient.put(logItem).promise();
}

async function sendTestOrderToWMS(order) {
  let orderPayload = mapOrderToWmsPayload(order);
  orderPayload.IsTest = true;
  const params = {
    Message: JSON.stringify(orderPayload, null, 2).replace(/\//g, "\\/"),
    Subject: `Order Number: ${orderPayload.OrderId} (Order Create)`,
    TopicArn: process.env.SNS_TOPIC_WMS_CREATE_ORDER
  };

  return sns.publish(params).promise();
}

function getEmailFromPayment(order) {

  if (
    order.PaymentDetails &&
    order.PaymentDetails.AdditionalInformation &&
    order.PaymentDetails.AdditionalInformation.PayerEmail
  ) {
    return order.PaymentDetails.AdditionalInformation.PayerEmail.toLowerCase();
  }

  return 'customernotfound@prettylittlething.com';
}


function isRoyaltySku(item) {
  return item.includes('-SUBSCRIPTION') && item.includes('YEAR');
}

function isAutomatedOrder(order) {
  return order.Email.includes('@pltautomation.com');
}

function isRoyaltyShippingDiscounted(order) {
  if (order.ShippingDetails &&
    ROYALTY_SHIPPING_METHODS.includes(order.ShippingDetails.Method) &&
    order.ShippingDetails.Price == 0 &&
    order.ShippingDetails.DiscountAmount &&
    order.ShippingDetails.DiscountAmount > 0
  ) {
    return true;
  }

  return false;
}

async function getOnHoldReasonTypes(order) {
  const reasons = [];
  if (isMenaCustomerServiceScreeningRequired(order)) {
    const customerDetails = await getCustomerDetails(order.CustomerUuid);

    if (isNewCustomer(customerDetails)) {
      reasons.push('NewCustomer');
    }

    if (!hasGPS(order)) {
      reasons.push('GpsMissing');
    }

    const orderType = order.ShippingDetails.Method.toLowerCase() === 'worldpay' ? 'MENA_COD' : 'STANDARD';

    if (isOverThresholdValue(order, orderType) && isPassportIdMissing(order)) {
      reasons.push('PassportIdOverThreshold');
    }

    if (isCustomerBlacklisted(customerDetails)) {
      reasons.push('BlacklistedCustomer');
    }
  }

  return reasons;
}

function isPassportIdMissing(order) {
  return !order.CustomerDetails.PassportID;
}

function isNewCustomer(customerDetails) {
  return customerDetails.Message && customerDetails.Message.CashOnDeliveryApproved === undefined;
}

function isCustomerBlacklisted(customerDetails) {
  return customerDetails.Message && customerDetails.Message.CashOnDeliveryApproved === false;
}

function hasGPS(order) {
  return (order.ShippingDetails.Additional !== undefined)
    && (order.ShippingDetails.Additional.Geo !== undefined)
    && order.ShippingDetails.Additional.Geo.Lng
    && order.ShippingDetails.Additional.Geo.Lat;
}

async function getCustomerDetails(customerUUID) {
  const url = process.env.CUSTOMER_INFORMATION_API_ENDPOINT;
  const token = await getSsmParameter(process.env.CUSTOMER_INFORMATION_API_KEY_SSM_PARAM_NAME);

  return new Promise(async (resolve) => {
    return axios
      .get(`${url}/${customerUUID}`, {
        headers: {
          'x-api-key': token,
        },
        timeout: 10000,
      })
      .then((resp) => {
        return resolve(resp.data);
      })
      .catch((err) => {
        console.error('CCS call failed', err.message);
        resolve({});
      });
  });
}

function getSsmParameter(name) {
  if (ssmCache[name]) {
    return ssmCache[name];
  }

  return ssm
    .getParameter({
      Name: name,
      WithDecryption: true,
    })
    .promise()
    .then((ssmData) => {
      ssmCache[name] = ssmData.Parameter.Value;
      return ssmData.Parameter.Value;
    });
}

function isMenaCustomerServiceScreeningRequired(order) {
  const menaShippingCodes = ['bh_cod', 'jo_cod', 'sa_cod', 'ae_cod'];
  if (!order.ShippingDetails || !order.ShippingDetails.Method || !HELD_MENA_ORDER || isAutomatedOrder(order)) {
    return false;
  }

  return menaShippingCodes.includes(order.ShippingDetails.Method);
}
