const axios = require("axios");
const moment = require("moment");
let AWS = require("aws-sdk");
if (process.env.NODE_ENV !== "test") {
    const AWSXRay = require("aws-xray-sdk");
    AWS = AWSXRay.captureAWS(AWS);
}

const DEFAULT_FILTERS = [
  "identifier",
  "parent",
  "family_variant",
  "values.colour-option.<all_channels>.<all_locales>",
  "*size-option.<all_channels>.<all_locales>",
  "values.image-media.<all_channels>.<all_locales>.key",
  "values.name_localized-text.ecommerce.en_GB",
  "values.price-prices.<all_channels>.<all_locales>",
  "values.special_*.<all_channels>"
];

async function getProductionInformationBySku(skuArray, filters = []) {
  try {
    let { data } = await sendRequest({
      _source: {
        includes: filters.length == 0 ? DEFAULT_FILTERS : filters
      },
      query: {
        bool: {
          must: [{ terms: { identifier: skuArray } }]
        }
      }
    });

    if (data.hits.total == 0) {
      throw new ElasticSearchNoResultError("No Results from Elastic Search");
    }

    let products = [];
    let parentIds = []; 
    for (const item of data.hits.hits) {
      const product = item._source;

      products.push({
        Sku: product.identifier,
        Parent: product.parent,
        Name: getProductName(product),
        Image: getImage(product),
        Colour: getColour(product),
        Size: getSize(product),
        Options: selectedValues(getColour(product), getSize(product)),
        OriginalPrice: getOriginalPrice(product),
        SpecialPrice: getSpecialPrice(product)
      });

      if (product.parent !== null) {
        parentIds.push(product.parent);
      }
    }

    let missingSku = skuArray.filter(sku => {
      return !products.find(product => product.Sku == sku);
    });

    if (missingSku.length > 0) {
      return {
          MissingSku: missingSku
      }
    }

    if (process.env.STEP_PIM_UPDATE_PRICE_FROM_PARENT == "true" && parentIds.length > 0) {
      products = await updatePricesFromParents(products, parentIds);
    }

    return {
      Products: products,
      MissingSku: missingSku
    };
  } catch (err) {
    throw err;
  }
}

async function updatePricesFromParents(products, parentIds) {
  const parentProducts = await getPriceInformationFromParent(parentIds);

  for(const product of products) {
     const parentProduct = parentProducts.find(parentItem => parentItem.Sku === product.Parent);

     if (parentProduct) {
       product.OriginalPrice = parentProduct.OriginalPrice;
       product.SpecialPrice = parentProduct.SpecialPrice;
     }
  }

  return products;
}

async function getPriceInformationFromParent(skuArray) {
  const filters = [
    "identifier",
    "values.price-prices.<all_channels>.<all_locales>",
    "values.special_*.<all_channels>"
  ];

  try {
    let { data } = await sendRequest({
      _source: {
        includes: filters
      },
      query: {
        bool: {
          must: [{ terms: { identifier: skuArray } }]
        }
      }
    });

    const parentProducts = [];
    for (const item of data.hits.hits) {
      const product = item._source;

      parentProducts.push({
        Sku: product.identifier,
        OriginalPrice: getOriginalPrice(product),
        SpecialPrice: getSpecialPrice(product)
      });
    }

    return parentProducts;

  } catch(err) {
    throw err;
  }
}

async function sendRequest(body) {
  const url = process.env.PIM_ELASTICSEARCH_URL
  const configs = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": await getCredential()
    }
  };

  return axios.post(url, JSON.stringify(body), configs);
}

function getSize(item) {
  if (item.family_variant) {
    let sizeField = `${item.family_variant}-option`;
    let size = valueAllLocales(item, sizeField);

    if (size) {
      let sizeFilter = size
        .replace(item.family_variant.toLowerCase(), "")
        .replace(/_/g, " ")
        .trim();

      return capitalize(sizeFilter);
    }
  }

  return false;
}

function getColour(item) {
  let colour = valueAllLocales(item, "colour-option");

  if (colour) {
    return capitalize(colour.replace("colour_", ""));
  }

  return false;
}

function selectedValues(colour, size) {
    let selectedValues = [];

    if (colour) {
        selectedValues.push({
            "label": "Colour",
            "value": colour
        })
    }

    if (size) {
        selectedValues.push({
            "label": "Size",
            "value": size
        })
    }

    return selectedValues;
}

function getImage(item) {
  const url = "https://cdn-img.prettylittlething.com/";
  let image = valueAllLocales(item, "image-media");

  if (image) {
    return url + image.key;
  }

  return null;
}

function getProductName(item) {
  if (item.values["name_localized-text"].ecommerce.en_GB) {
    return item.values["name_localized-text"].ecommerce.en_GB;
  }

  return "Unknown Product Name";
}

function getOriginalPrice(item) {
  let price = valueAllLocales(item, "price-prices");

  if (price && price.GBP) {
    return parseFloat(price.GBP);
  }

  return 0.0;
}

function getSpecialPrice(item) {
  const specialFromDate = getSpecialFromDate(item);
  const specialEndDate = getSpecialEndDate(item);
  const specialPrice = valueAllLocales(item, "special_price-prices");
  const todayDate = moment();

  // with specialFromDate and specialEndDate
  if (specialFromDate && specialEndDate && specialPrice && specialPrice.GBP) {
      if (todayDate > moment(specialFromDate) && todayDate < moment(specialEndDate)) {
          return parseFloat(specialPrice.GBP);
      }
  }

  // with specialFromDate and without specialEndDate
  if (specialFromDate && !specialEndDate && specialPrice && specialPrice.GBP) {
    if (todayDate > moment(specialFromDate)) {
      return parseFloat(specialPrice.GBP);
    }
  }

  // with specialEndDate and without specialFromDate
  if (!specialFromDate && specialEndDate && specialPrice && specialPrice.GBP) {
    if (todayDate < moment(specialEndDate)) {
      return parseFloat(specialPrice.GBP);
    }
  }

  // without specialEndDate and specialFromDate
  if (!specialFromDate && !specialEndDate && specialPrice && specialPrice.GBP) {
    return parseFloat(specialPrice.GBP);
  }

  return false;
}

function getSpecialFromDate(item) {
  const specialFromDate = value(item, 'special_from-date');
  const specialFromTime = value(item, 'special_from_time-text');

  if (specialFromDate && specialFromTime) {
      if (specialFromDate.en_GB && specialFromTime.en_GB) {
          return `${specialFromDate.en_GB} ${specialFromTime.en_GB}`;
      }
  }

  return false;
}

function getSpecialEndDate(item) {
  const specialEndDate = value(item, 'special_to-date');
  const specialEndTime = value(item, 'special_to_time-text');

  if (specialEndDate && specialEndTime) {
      if (specialEndDate.en_GB && specialEndTime.en_GB) {
          return `${specialEndDate.en_GB} ${specialEndTime.en_GB}`;
      }
  }

  return false;
}


async function getCredential() {
  try {
      const SSM = new AWS.SSM();
      let ssmData = await SSM.getParameter({
          Name: "pim-es.plt-api-key",
          WithDecryption: true
      }).promise();

      return ssmData.Parameter.Value;
  } catch (err) {
      throw err;
  }
}

function capitalize(string) {
  return string
    .toLowerCase()
    .split(" ")
    .map(function(chunk) {
      return chunk.charAt(0).toUpperCase() + chunk.substring(1);
    })
    .join(" ");
}


function value(item, attribute) {
  if (item.values[attribute] && item.values[attribute]["<all_channels>"]) {
    return item.values[attribute]["<all_channels>"];
  }

  return undefined;
}

function valueAllLocales(item, attribute) {
  if (
    item.values[attribute] &&
    item.values[attribute]["<all_channels>"] &&
    item.values[attribute]["<all_channels>"]["<all_locales>"]
  ) {
    return item.values[attribute]["<all_channels>"]["<all_locales>"];
  }

  return undefined;
}

class ElasticSearchNoResultError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ElasticSearchNoResultError'
    this.message = message
  }
}

module.exports = { getProductionInformationBySku, ElasticSearchNoResultError };