const successResponse = require('./data/success-responce');
const successResponseForHyphen = require('./data/success-responce-for-hyphen');
const missingSkuResponse = require('./data/missing-sku-responce');

describe("ProductService unit test", () => {
    it("success response", async () => {
        const fetchMany = jest.fn(() => require('./data/product-service-api-many-spedial-price-empty'));
        jest.spyOn(require('@prettylittlething/product-service'), 'productService').mockImplementation(() => ({ fetchMany }));
        const { getProductionInformationBySku } = require('../ProductService');

        const products = await getProductionInformationBySku(['CLU1698/4/72', 'CLU1698/4/75']);
        expect(products).toEqual(successResponse);
    });

    it("success response sku with hyphen", async () => {
        const fetchMany = jest.fn(() => require('./data/product-service-api-many-spedial-price-empty-hyphen-in-sku'));
        jest.spyOn(require('@prettylittlething/product-service'), 'productService').mockImplementation(() => ({ fetchMany }));
        const { getProductionInformationBySku } = require('../ProductService');

        const products = await getProductionInformationBySku(['CLU1698-72', 'CLU1698-75']);
        expect(products).toEqual(successResponseForHyphen);
    });

    it("not empty property MissingSku", async () => {
        const fetchMany = jest.fn(() => require('./data/product-service-api-many-with-missing-sku'));
        jest.spyOn(require('@prettylittlething/product-service'), 'productService').mockImplementation(() => ({ fetchMany }));
        const { getProductionInformationBySku } = require('../ProductService');

        const products = await getProductionInformationBySku(['CLU1698/4/72', 'CLU1698/4/75']);
        expect(products).toEqual(missingSkuResponse);
    });
});
