'use strict';

const Validator = require('jsonschema').Validator;

function validate(event) {
    let validator = new Validator();

    let requestSchema = {
        "id": "/Request",
        "type": "object",
        "properties": {
            "OrderId" : {
                "not" : {}
            },
            "CurrencyCode": {"type": ["string"]},
            "EstimatedDeliveryDate": {"type": ["string", "null"]},
            "RequestedDeliveryDate": {"type": ["string", "null"]},
            "DiscountCode": {"type": ["string", "null"]},
            "DiscountCouponDescription": {"type": ["string", "null"]},
            "CustomerDetails": {"$ref": "/CustomerDetails"},
            "BillingDetails": {"$ref": "/BillingDetails"},
            "Items": {"$ref": "/Items"},
            "ShippingDetails": {"$ref": "/ShippingDetails"},
            "StoreId": {"type": "string"},
            "OrderSource": {"type": "string"},
            "ParentOrderNumber": {"type": "string"},
            "ParentOrderId": {"type": "string"}
        },
        "required": [
            "CurrencyCode",
            "CustomerDetails",
            "BillingDetails",
            "Items",
            "ShippingDetails"
        ]
    };

    validator.addSchema(getAddressSchema(), '/SimpleAddress');
    validator.addSchema(getCustomerDetailsSchema(), '/CustomerDetails');
    validator.addSchema(getItemSchema(), '/Items');
    validator.addSchema(getBillingDetailsSchema(), '/BillingDetails');
    validator.addSchema(getShippingDetailsSchema(), '/ShippingDetails');

    let validationResult = validator.validate(event, requestSchema);

    let errors = [];

    for (const error of validationResult.errors) {
        errors.push(error.stack);
    }

    return errors;
}

function getItemSchema() {
    return {
        "id": "/Items",
        "type": "array",
        "minItems": 1,
        "items": {
            "type": "object",
            "properties": {
                "BaseDiscount": getPriceType(),
                "BaseOriginalPrice": getPriceType(),
                "BasePrice": getPriceType(),
                "BaseTaxAmount": getPriceType(),
                "Discount": getPriceType(),
                "Image": {"type": ["string", "null"]},
                "OriginalPrice": getPriceType(),
                "Price": getPriceType(),
                "TaxAmount": getPriceType(),
                "TaxPercent": {"type": "number"},
                "Name": {"type": "string"},
                "Sku": {"type": "string"},
                "Size": {"type": ["string", "null"]},
                "Quantity": {"type": "number"},
                "ProductType": {"type": ["string", "null"]},
                "SelectedValues": {
                    "type": ["array", "null"],
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "value": {"type": ["string", "number"]}
                        }
                    }
                }
            },
            "required": ["Sku", "Quantity"]
        }
    }
}

function getCustomerDetailsSchema() {
    return {
        "id": "/CustomerDetails",
        "type": "object",
        "properties": {
            "CustomerId": {"type": "string"},
            "Email": {"type": "string"},
            "FirstName": {"type": "string"},
            "LastName": {"type": "string"},
            "Phone": {"type": "string"},
            "GroupId": {"type": "string"},
            "GroupName": {"type": ["string", "number"]},
            "Royalty": {
                "type": "object",
                "properties": {
                    "royaltyExpiry": {"type": ["string", "null"]},
                    "royaltyStart": {"type": ["string", "null"]}
                }
            }
        },
        "required": ["Email", "FirstName", "LastName", "Phone"]
    };
}

function getAddressSchema() {
    return {
        "id": "/SimpleAddress",
        "type": "object",
        "properties": {
            "City": {"type": "string"},
            "CountryCode": {"type": "string"},
            "Postcode": {"type": "string"},
            "Region": {"type": ["string", "null"]},
            "Street": {"type": "string"}
        },
        "required": ["City", "CountryCode", "Postcode", "Street"]
    };
}

function getBillingDetailsSchema() {
    return {
        "id": "/BillingDetails",
        "type": "object",
        "properties": {
            "Address": {"$ref": "/SimpleAddress"},
            "FirstName": {"type": "string"},
            "LastName": {"type": "string"}
        },
        "required": ["FirstName", "LastName", "Address"]
    };
}

function getShippingDetailsSchema() {
    return {
        "id": "/ShippingDetails",
        "type": "object",
        "properties": {
            "Address": {"$ref": "/SimpleAddress"},
            "FirstName": {"type": "string"},
            "LastName": {"type": "string"},
            "BasePrice": getPriceType(),
            "Price": getPriceType(),
            "DiscountAmount": getPriceType(),
            "Method": {"type": ["string", "null"]},
            "Carrier": {"type": ["string", "null"]},
            "Type": {"type": "string"}
        },
        "required": ["FirstName", "LastName", "Address", "Method", "Type"]
    };
}

function getPriceType() {
    return {
        "type": "number",
        "minimum": 0
    };
}

module.exports = {
    validate
};