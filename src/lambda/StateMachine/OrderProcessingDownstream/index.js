let AWS = require("aws-sdk");
if (process.env.NODE_ENV !== "test") {
  const AWSXRay = require("aws-xray-sdk");
  AWS = AWSXRay.captureAWS(AWS);
}

const { OMS } = require('plt-layer');
const { mapOrderToSagePayload, mapOrderToWmsPayload } = require("./order_payload");

let docClient;
let sns;
let MENA_ORDER_SAGE_ONLY;

exports.handler = async event => {
  docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });
  sns = new AWS.SNS();

  const INVOKE_INVENTORY_STEP = process.env.INVOKE_INVENTORY_STEP === "true";
  const WAREHOUSE_SHEFFIELD = 0;
  const ORDER_IGNORE_LIST = ["Cancelled - Fraud Check", "Cancelled - Eggplant"];
  MENA_ORDER_SAGE_ONLY = process.env.MENA_ORDER_SAGE_ONLY === "true";

  try {
    if (!event.OrderId) {
      throw new Error("OrderId is missing");
    }

    logger(event.OrderId, "Processing");
    let orderRecord = await OMS.Order.getById(event.OrderId);

    if (isOrderOnIgnoreList(ORDER_IGNORE_LIST, orderRecord) === false) {
      orderRecord = setOrderLineAllocationFlag(
        orderRecord,
        WAREHOUSE_SHEFFIELD
      );

      switch (getOrderType(orderRecord)) {
        case 'preOrder':
          await publishOrderToSage(orderRecord);
          logger(orderRecord.OrderId, "Message published to SNS (PreOrder Create)");
          break;

        case 'MenaOrder-OnHold':
          await publishOrderToSage(orderRecord);
          logger(orderRecord.OrderId, "Message published to Sage (Mena Order)");
          break;

        default:
          await publishOrderToSage(orderRecord);
          await publishOrderToWms(orderRecord);
          logger(orderRecord.OrderId, "Message published to SNS (Order Create)");
      }

      if (isMagentoOrder(orderRecord) && INVOKE_INVENTORY_STEP) {
        await updateInventoryStock(orderRecord);
      }

      await OMS.Order.updateOrder(orderRecord.OrderId, {
        OrderProcessed: "true",
      })
    } else {
      logger(orderRecord.OrderId, "Skipped Published Order Create via SNS");
    }

  } catch (err) {
    console.log(JSON.stringify(event));
    throw err;
  }
};

function isOrderOnIgnoreList(ignoreList, orderRecord) {
  return ignoreList.includes(orderRecord.OrderStatus);
}

function setOrderLineAllocationFlag(order, warehouseAllocate) {
  order.Items.forEach(orderLine => (orderLine.allocate = warehouseAllocate));

  return order;
}

function publishOrderToSage(orderRecord) {
  let orderPayload = mapOrderToSagePayload(orderRecord);

  const params = {
    Message: JSON.stringify(orderPayload, null, 2).replace(/\//g, "\\/"),
    Subject: `Order Number: ${orderPayload.OrderId} (Order Create)`,
    TopicArn: process.env.sns_topic_order_create_exclude_wms
  };

  return sns.publish(params).promise();
}

function publishOrderToWms(orderRecord) {
  let orderPayload = mapOrderToWmsPayload(orderRecord);
  const params = {
    Message: JSON.stringify(orderPayload, null, 2).replace(/\//g, "\\/"),
    Subject: `Order Number: ${orderPayload.OrderId} (Order Create)`,
    TopicArn: process.env.SNS_TOPIC_WMS_CREATE_ORDER
  };

  return sns.publish(params).promise();
}

async function updateInventoryStock(orderRecord) {
  //publish to inventory service magento orders
  filteredItems = orderRecord.Items.filter(item => {
    const acceptable = ["configurable", "simple"];
    return acceptable.indexOf(item.ProductType) != -1;
  });

  for (const item of filteredItems) {
    const message = {
      OperationType: "Order",
      From: `${orderRecord.OrderNumber}`,
      ProductId: item.Sku,
      ProductQty: -parseInt(item.Quantity)
    };

    const params = {
      Message: JSON.stringify(message),
      TopicArn: process.env.WMS_INVENTORY_SNS_TOPIC
    };

    await sns.publish(params).promise();
    console.log(`Order Number: ${orderRecord.OrderNumber} Stock updated`, message);
  }
}

function isMagentoOrder(orderRecord) {
  return typeof orderRecord.OrderSource === "undefined";
}

function logger(orderNumber, text = "") {
  console.log(`-- (Order Number: ${orderNumber}) ${text}`);
}

function getOrderType(orderRecord) {
  if (orderRecord.IsPreOrder === true) {
    logger(orderRecord.OrderNumber, "It is Pre-Order");
    return 'preOrder';
  }

  if (MENA_ORDER_SAGE_ONLY && orderRecord.MenaHeld) {
    return 'MenaOrder-OnHold';
  }

  return 'default';
}
