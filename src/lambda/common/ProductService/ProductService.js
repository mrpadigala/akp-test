const {
    productService,
    ProductNotFoundError,
    InvalidRequestError,
} = require('@prettylittlething/product-service');

function mapping(item) {
    return item.sizes.map(i => {
        return {
            Sku: i.sku,
            Name: item.name,
            Image: item.mainImage,
            Colour: item.colour,
            Size: i.size,
            Options: [
                { label: 'Colour', value: item.colour },
                { label: 'Size', value: i.size }
            ],
            OriginalPrice: Number(item.price),
            SpecialPrice: item.specialPriceActive ? Number(item.specialPrice) : false,
        };
    });
}

function getShortSKU(skuArray) {
    return skuArray.map(sku => {
        const index = sku.search(/\/|-/);
        return index !== -1 ? sku.substring(0, index) : sku;
    });
}

async function getProductionInformationBySku(skuArray, apiKey) {
    try {
        const { fetchMany } = productService({
            apiUrl: process.env.PRODUCT_SERVICE_URL,
            apiKey,
            locale: 'en-GB',
            includeDisabled: true
        });

        const items = await fetchMany(getShortSKU(skuArray));
        const products = [];
        // eslint-disable-next-line no-unused-vars
        for (let [key, value] of Object.entries(items)) {
            mapping(value).forEach(item => products.push(item));
        }

        return {
            Products: products.filter(i => skuArray.includes(i.Sku)),
            MissingSku: skuArray.filter(sku => {
                return !products.find(product => product.Sku === sku);
            }),
        };
    } catch (err) {
        throw err;
    }
}

module.exports = { getProductionInformationBySku, InvalidRequestError, ProductNotFoundError };
