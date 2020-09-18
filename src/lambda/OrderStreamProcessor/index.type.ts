export interface IEvent {
  Records: IRecord[];
}

export interface IRecord {
  eventID: string;
  eventName: string;
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  dynamodb: {
    ApproximateCreationDateTime: number;
    Keys: any;
    NewImage: any;
    OldImage: any;
    SequenceNumber: string;
    SizeBytes: number;
    StreamViewType: string;
  };
  eventSourceARN: string;
}
