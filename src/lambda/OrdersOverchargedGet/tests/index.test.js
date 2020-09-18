const AWS = require('aws-sdk-mock');
const lambdaFunc = require('..');

function generateOrders(count, overchargeItems) {
    const orders = [];
    const itemPrice = 20;
    const shipping = 10;
    const total = itemPrice + shipping;
    for (let i = 1; i <= count; i++) {
        const overcharge = overchargeItems && overchargeItems[`id_${i}`];
        orders.push({
            OrderNumber: `id_${i}`,
            Items: [
                {
                    RowTotalActual: itemPrice,
                }
            ],
            OrderTotalDetails: {
                Shipping: shipping,
                Paid: overcharge ? total + overcharge : total,
            }
        });
    }

    return orders;
}

describe('Overcharge tests', () => {
    afterEach(() => {
        AWS.restore();
    });

    it('No orders with overcharge', async () => {
        AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
            expect(params.TableName).toEqual("Orders");
            callback(null, { Count: 150, Items: generateOrders(150) });
        });

        await lambdaFunc.handler({ date: '2019-01-01' }, null, (err, result) => {
            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({});
        });
    });

    it("Orders with overcharge", async () => {
        const overcharged = { id_50: 10, id_120: 20 };
        AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
            expect(params.TableName).toEqual("Orders");
            callback(null, { Count: 150, Items: generateOrders(150, overcharged) });
        });

        await lambdaFunc.handler({ date: '2019-01-01' }, null, (error, result) => {
            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual(overcharged);
        });

    });
});
