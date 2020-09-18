function throwIfUndefined(value, keyName) {
  if (value == undefined) {
    throw `It could not map ${keyName}`;
  }

  return value;
}

function mapOrderToSagePayload(order) {
  return mapOrderPayload(order);
}

function mapOrderToWmsPayload(order) {
  let payload = mapOrderPayload(order);
  payload.OrderAttributes.InfluencerOrder = order.OrderSource === 'Influencer';

  if (order.OrderSource === 'Influencer' && order.UserEmail) {
    payload.CustomerAttributes.CustomerEmail = order.UserEmail;
  }

  if (order.OrderSource === 'Sample' && order.IsUrgent === true) {
    payload.OrderAttributes.UrgentSampleOrder = true;
  }

  payload.OrderAttributes.ParcelShopID = order.ShippingDetails.ParcelShopId;

  return payload;
}

function mapOrderPayload(order) {
  if (order.CustomerDetails.Email.indexOf("@vogacloset.com") !== -1) {
    order.ShippingDetails.Method = "VOGACLT";
  }

  const billingAddressStreet = order.BillingDetails.Address.Street;
  const shippingAddressStreet = order.ShippingDetails.Address.Street;

  let orderLines = [];
  order.Items.forEach(function(item) {
    orderLines.push({
      ProductType: item.ProductType,
      ProductName: item.Name,
      ProductSku: item.Sku,
      ProductQty: item.Quantity,
      OriginalPrice: item.OriginalPrice,

      Price: item.Price,
      SubTotal: item.RowTotal,
      TaxAmount: item.TaxAmount,
      TaxRate: item.TaxPercent,
      DiscountAmount: item.Discount,
      RowTotal: parseFloat(item.RowTotalInclTax - item.Discount),
      RowTotalInclTax: item.RowTotalInclTax,
      allocate: item.allocate // Allocate from split order
    });
  });

  try {
    return {
      OrderId: throwIfUndefined(order.OrderNumber, 'OrderNumber'),
      OrderAttributes: {
        OrderDate: order.OrderDate,
        RequestedDeliveryDate: order.RequestedDeliveryDate,
        OrderStatus: order.OrderStatus,
        OrderTakenBy: "MagentoCE",
        Domain: order.Domain,
        ShippingMethod: getShippingMethod(order.ShippingDetails),
        HDNCode: (order.HDNCode != null)? order.HDNCode:"",
        StoreId: order.StoreId,
        SMSAlert: order.SMSAlert || null,
        EbayID: 0,
        NumberOfOrderLines: order.Items.length,
        DiscountCodeUsed: order.DiscountCode || null,
        SiteNumber: order.CollectPlusSiteNumber || null,
        PAAccountNumber: order.CollectPlusAccountCode || null,
        AgentData: order.AgentData,
        DeviceType: order.DeviceType
      },
      PaymentDetails: {
        SettlementMethod: getSettlementMethod(order.PaymentDetails),
        SettlementReference: order.PaymentDetails ? order.PaymentDetails.Id : '',
        CurrencyISO: order.CurrencyCode,
        TaxCode: (order.OrderTax != undefined && order.OrderTax.length > 0)? order.OrderTax[0].Code : "",
        TaxRate: (order.OrderTax != undefined && order.OrderTax.length > 0)? parseFloat(order.OrderTax[0].Percent) : "",
        SubTotal: order.OrderTotalDetails.Subtotal,

        OriginalShipping: order.OrderTotalDetails.OriginalShipping,
        Shipping: order.OrderTotalDetails.Shipping ? order.OrderTotalDetails.Shipping : 0,

        GrandTotalExcTax: parseFloat(order.OrderTotal - order.TaxAmount),
        Tax: order.TaxAmount ? order.TaxAmount : 0,
        GrandTotalIncTax: order.OrderTotal,
        TotalPaid: parseFloat(order.OrderTotalDetails.Paid).toFixed(4),
        StoreCredit: getTotalStoreCredit(order),
        TotalDue: (order.OrderTotalDetails != undefined && order.OrderTotalDetails.Due > 0)? parseFloat(order.OrderTotalDetails.Due): 0,
        TotalDiscount: order.OrderTotalDetails.Discount ? order.OrderTotalDetails.Discount : 0
      },
      AnalysisCodes: {
        AnalysisCode5: (typeof order.DiscountCouponDescription !== 'undefined' && order.DiscountCouponDescription != null) ? order.DiscountCouponDescription : ""
      },
      CustomerAttributes: {
        CustomerUuid: order.CustomerUuid,
        CustomerName: order.CustomerDetails.FirstName + ' ' + order.CustomerDetails.LastName,
        CustomerType: order.CustomerDetails.Type,
        CustomerEmail: order.CustomerDetails.Email,
        CustomerTelephone: order.ShippingDetails.Phone || order.CustomerDetails.Phone
      },
      BillingAddress: {
        Name: order.BillingDetails.FirstName + ' ' + order.BillingDetails.LastName,
        AddressLine1: billingAddressStreet.split("\n")[0],
        AddressLine2: (billingAddressStreet.split("\n")[1] != undefined)? billingAddressStreet.split("\n")[1] : "",
        AddressLine3: (billingAddressStreet.split("\n")[2] != undefined)? billingAddressStreet.split("\n")[2] : "",
        City: order.BillingDetails.Address.City,
        County: (order.BillingDetails.Address.Region !=undefined)? order.BillingDetails.Address.Region : null,
        PostCode: order.BillingDetails.Address.Postcode,
        Country: order.BillingDetails.Address.CountryCode,
      },
      ShippingAddress: {
        Name: order.ShippingDetails.FirstName + ' ' + order.ShippingDetails.LastName,
        AddressLine1: shippingAddressStreet.split("\n")[0],
        AddressLine2: (shippingAddressStreet.split("\n")[1] != undefined)? shippingAddressStreet.split("\n")[1] : "",
        AddressLine3: (shippingAddressStreet.split("\n")[2] != undefined)? shippingAddressStreet.split("\n")[2] : "",
        City: order.ShippingDetails.Address.City,
        County: (order.ShippingDetails.Address.Region !=undefined)? order.ShippingDetails.Address.Region : null,
        PostCode: order.ShippingDetails.Address.Postcode,
        Country: order.ShippingDetails.Address.CountryCode,
      },
      OrderLines: orderLines
    }
  }
  catch (err) {
    throw err;
  }
}

const getSettlementMethod = (payment) => {
  let method = '';

  if (!payment || !payment.Method) {
    return method;
  }

  if (payment.Method == 'free' || payment.Method == 'cashondelivery') {
    method = 'CASH ON DELIVERY';
  } else if (payment.Method.indexOf('paypal') !== -1) {
    method = 'Paypal';
  } else if (payment.Method.indexOf('realex') !== -1 || payment.Method.indexOf('worldpay') !== -1) {
    method = 'Card';
  } else if (payment.Method.indexOf('afterpay') !== -1 ) {
    method = 'Afterpay';
  } else if (payment.Method.indexOf('clearpay') !== -1) {
    method = 'Clearpay';
  } else if (payment.Method.indexOf('klarna') !== -1) {
    method = 'Klarna';
  } else if (payment.Method === 'Store Credit') {
    method = 'StoreCredit';
  } else if (payment.Method === 'COD') {
    method = 'COD';
  } else if (payment.Method === 'laybuy') {
    method = 'Laybuy';
  } else if (payment.Method === 'Adyen') {
    method = 'Adyen';
  }


  return method;
}

const getShippingMethod = (shipment) => {
  if (!shipment.Method || shipment.Method == 0) {
    return "";
  }

  return shipment.Method;
}

function getTotalStoreCredit(order) {
  return order.PaymentDetails && !isNaN(order.PaymentDetails.StoreCredit)
    ? parseFloat(order.PaymentDetails.StoreCredit).toFixed(4)
    : 0;
}

module.exports = {
  mapOrderToSagePayload,
  mapOrderToWmsPayload
};
