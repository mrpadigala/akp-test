let AWS = require("aws-sdk");
if (process.env.NODE_ENV !== "test") {
    const AWSXRay = require("aws-xray-sdk");
    AWS = AWSXRay.captureAWS(AWS);
}

async function getOrderNumber() {
    const tries = 10;//process.env.HOW_MANY;
    for(let i = 0; i <= tries; i++) {
        const item = await returnOrderNumber();
        const updated = await updateItem(item);
        if (updated) {
            return item;
        }
    }
}

async function returnOrderNumber() {
    const params = {
        TableName: "OrderNumberPool",
        IndexName: "Allocated-index",
        KeyConditionExpression: `Allocated = :isAllocated `,

        ExpressionAttributeValues: {
            ":isAllocated": "false"
        },
        ScanIndexForward: false,
        Limit: 1000
    };
    try{
        let documentClient = new AWS.DynamoDB.DocumentClient();
        const data = await documentClient.query(params).promise();
        const randomItemKey = Math.floor(Math.random() * data.Items.length);
        return data.Items[randomItemKey];
    } catch (e) {
        console.error(e);
        throw new Error("Could not retrieve Order Numbers");
    }
}

async function updateItem(item) {
    const orderNumber = item.OrderNumber;
    const params = {
        TableName:"OrderNumberPool",
        Key: {
            OrderNumber : orderNumber
        },
        UpdateExpression: "set Allocated = :allocated",
        ConditionExpression: "Allocated = :notAllocated",
        ExpressionAttributeValues:{
            ":allocated": "true",
            ":notAllocated": "false"
        },
        ReturnValues:"UPDATED_NEW"
    };

    try{
        let documentClient = new AWS.DynamoDB.DocumentClient();
        await documentClient.update(params).promise();
        return true;
    } catch (e) {
        console.error(item.OrderNumber, "Unable to update item. Error JSON:", e.message);
        return false;
    }
}

module.exports = { getOrderNumber };
