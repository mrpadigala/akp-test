export interface ICarrierCSVFile {
  IsRTO: 'TRUE' | 'FALSE';
  Reference: string;
  PackageStatus: string;
  BillingType: string;
}

export interface IEvent {
  Records: IEventRecord[];
}

interface IEventRecord {
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  eventTime: string;
  eventName: string;
  userIdentity: {
    principalId: string;
  };
  requestParameters: {
    sourceIPAddress: string;
  };
  responseElements: {
    'x-amz-request-id': string;
    'x-amz-id-2': string;
  };
  s3: {
    s3SchemaVersion: string;
    configurationId: string;
    bucket: {
      name: string;
      ownerIdentity: {
        principalId: string;
      };
      arn: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
      versionId: string;
      sequencer: string;
    };
  };
}

export interface IFile {
  bucket: string;
  filename: string;
}

export interface IEnv {
  CARRIER_FTP_HOST: string;
  CARRIER_FTP_USER: string;
  CARRIER_FTP_PASSWORD_SSM_PARAM_NAME: string;
  CARRIER_FTP_PATH: string;
  CARRIER_FTP_SECURE_CONNECTION: string;
  CARRIER_S3_SYNC_BUCKET: string;
  CARRIER_S3_SYNC_PATH: string;
  CUSTOMER_INFORMATION_API_ENDPOINT: string;
  CUSTOMER_INFORMATION_API_KEY_SSM_PARAM_NAME: string;
}
