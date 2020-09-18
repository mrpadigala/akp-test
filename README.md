# OMS-Order-Processors

## Lambda Functions

| Function Name                            | Description                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| OMS-OrderProcessing-OrdersQueueProcessor | SQS trigger a lambda function and determine to put an Order in the Orders or Holding table |

## Install & setup

For setup and install use next command:
```
npm run local-setup
```
You have to put [Github personal token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) with following permissions: `repo` and `read:packages`

---

## Development

[NPM and NodeJS][nodejs] are required for Lambda functions development

### Install Development Dependencies

```
cd src/lambda
npm install
```

## Serverless
### Install DynamoDB (only once):
```
npm run sls:db:install
```
DynamoDB & ElasticMQ need to install JAVA JDK:
https://www.oracle.com/java/technologies/javase-jdk14-downloads.html

### Start development environment:
```
npm start
```
API Getaway: `http://localhost:3000/dev/*`

DynamoDB endpoint: `http://localhost:4569`

S3 endpoint: `http://localhost:8008`

### Stop development environment
```
npm stop
```

### Show logs
```
npm run sls:log
```

The file `serverless.yaml` contains API Routes, lambda functions & DynamoDB table structure.

The directory `serverless/tables` contains seeds for DynamoDB tables.

The directory `serverless/plt-layer` contains fake plt-layer module.

### Invoke lambda function:
```
serverless invoke local -f functionName -d '{ "data": "hello world" }'
```

### Upload test file to S3 bucket (webhook)
```
http://localhost:3000/dev/upload-file-to-s3?bucket=xxx&key=yyy&filename=zzz
```
`xxx` - bucket name

`yyy` - path and filename of destination file

`zzz` - file name from directory `src/lambda/serverless/s3/uploader/` which you want to upload to s3

___
### SQS

SQS works via ElasticMQ. Config file: `src/lambda/serverless/sqs/custom.conf`

---
 
| Functions                  | Command / URL                                                                                          | Params                                                                           |
| ---------------------------|--------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| MenaHeldOrders             | GET http://localhost:3000/dev/mena/held-orders                                                         |                                                                                  |
| MenaHeldOrderUpdate        | POST http://localhost:3000/dev/mena/held-order-update                                                  | `{"orderId": "3123213-12313-12323", "action": "contact-attempt"}`                |
| CashOnDeliveryNotifier     | serverless invoke local -f CashOnDeliveryNotifier -p 'CashOnDeliveryNotifier/tests/data/event.json'    |                                                                                  |
| OrderStreamProcessor       | just put item into table `OrdersV3`                                                                    |  uncomment line `- serverless-offline-dynamodb-streams` in `serverless.yaml`     |
 
## Run Unit Test
Coverage are generated in `src/lambda` directory
```
cd src/lambda
npm test
```

[nodejs]: https://nodejs.org/
