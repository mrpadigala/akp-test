export default interface IOrderV3 {
  AgentData: string;
  AttributeId: string;
  BaseCurrencyCode: string;
  BaseOrderTotal: string;
  BillingDetails: {
    Address: {
      City: string;
      CountryCode: string;
      Postcode: string;
      Region: string;
      Street: string;
    };
    FirstName: string;
    LastName: string;
    Phone: string;
  };
  CurrencyCode: string;
  CustomerDetails: {
    CustomerId: string;
    Email: string;
    FirstName: string;
    GroupId: string;
    GroupName: string;
    LastName: string;
    Phone: string;
    Royalty: {
      royaltyExpiry: string;
      royaltyStart: string;
    };
    Type: string;
  };
  CustomerUuid: string;
  DeviceType: string;
  DiscountCode: string;
  DiscountCouponDescription: number;
  Domain: string;
  EstimatedDeliveryDate: string;
  IndexCustomerId: string;
  IndexEmail: string;
  IndexOrderCreateDate: string;
  IndexOrderNumber: string;
  IndexPostcodeLastName: string;
  IP: string;
  IsPreOrder: boolean;
  OrderCreateTime: number;
  OrderDate: string;
  OrderId: string;
  Items: IOrderLines[];
  OrderSource: string;
  OrderStatus: string;
  OrderTax: IOrderTax[];
  OrderTotal: string;
  OrderTotalDetails: {
    Discount: string;
    OriginalShipping: number;
    Paid: string;
    Refunded: string;
    Shipping: string;
    ShippingInclTax: string;
    Subtotal: string;
  };
  PaymentDetails: {
    AdditionalInformation: {
      AdvancedRiskFinalScore: string;
      AdvancedRiskId: string;
      AdvancedRiskProvider: string;
      AdvancedRiskScore: string;
      AdvancedRiskThreshold: string;
      Amount: string;
      AVSResult: string;
      BasicRiskScore: string;
      CardNumber: string;
      ClientSideEncryption: boolean;
      CVCResult: string;
      JournalReference: string;
      JournalType: string;
      MerchantCode: string;
      PaymentMethod: string;
      PaymentModel: string;
      PaymentRefusalCode: string;
      PaymentRefusalDescription: string;
      PaymentStatus: string;
      WordPayOrderId: string;
    };
    Id: string;
    Method: string;
    Status: string;
    StoreCredit?: number;
  };
  QuoteId: string;
  RequestedDeliveryDate: string;
  ShippingDetails: {
    Address: {
      City: string;
      CountryCode: string;
      Postcode: string;
      Region: string;
      Street: string;
    };
    BaseDiscountAmount: string;
    BasePrice: string;
    Carrier: string;
    DiscountAmount: string;
    FirstName: string;
    LastName: string;
    Method: string;
    OriginalShipping: string;
    Phone: string;
    Price: string;
    ShippingAmountInclTax: string;
    Type: string;
  };
  SiteViewMode: string;
  StoreId: string;
  StoreName: string;
  TaxAmount: string;
}

interface IOrderTax {
  Amount: string;
  BaseAmount: string;
  BaseRealAmount: string;
  Code: string;
  NexusTaxTotal: {
    SalesTaxPercent: string;
    TotalSalesTax: string;
  };
  Percent: string;
}

interface ISelectedValues {
  Label: string;
  Value: string;
}

interface IOrderLines {
  BaseDiscount: string;
  BaseOriginalPrice: string;
  BasePrice: string;
  BaseRowTotal: string;
  BaseRowTotalInclTax: string;
  BaseTaxAmount: string;
  Colour: string;
  Discount: string;
  Image: string;
  Name: string;
  OriginalPrice: string;
  Price: string;
  ProductType: string;
  Quantity: string;
  RowTotal: string;
  RowTotalActual: number;
  RowTotalActualInclTax: number;
  RowTotalInclTax: string;
  SalesTax: string;
  SelectedValues: ISelectedValues[];
  Size: string;
  Sku: string;
  TaxAmount: string;
  TaxPercent: string;
}
