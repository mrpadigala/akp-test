### Put file to s3 for running lambda locally
```
http://localhost:3000/dev/upload-file-to-s3?bucket=plt-prod.cash-on-delivery.eu-west-1&key=incoming/file1.csv&filename=file1.csv
```

### Run CashOnDeliveryNotifier invoke locally
```
npx serverless invoke local -f CashOnDeliveryNotifier -p CashOnDeliveryNotifier/tests/data/event.json
```
