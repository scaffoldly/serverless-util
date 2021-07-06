import { define, Model } from 'dynamodb';
import Joi from 'joi';
import { AWS } from './exports';
import { PROCESS_UUID, SERVICE_NAME, STAGE } from './constants';
import { AttributeValue, DynamoDBRecord, DynamoDBStreamEvent, StreamRecord } from 'aws-lambda';
import { HttpRequestBase } from './interfaces';
import { Converter } from 'aws-sdk/clients/dynamodb';

const createTableName = (tableSuffix: string, serviceName: string, stage: string) => {
  return `${stage}-${serviceName}${tableSuffix ? `-${tableSuffix}` : ''}`;
};

export interface DynamoDBStreamEventContainer {
  event: DynamoDBStreamEvent;
}

export interface TableIndex {
  hashKey: string;
  rangeKey?: string;
  name: string;
  type: 'local' | 'global';
}

export class Table<T> {
  readonly model: Model<T>;
  private tableName: string;
  private serviceName: string;
  private stage: string;

  constructor(
    tableSuffix = '',
    serviceName: string = SERVICE_NAME,
    stage: string = STAGE,
    schema: { [key: string]: Joi.AnySchema },
    hashKey: string,
    rangeKey?: string,
    indexes?: TableIndex[],
  ) {
    let options: AWS.DynamoDB.ClientConfiguration = {};
    if (stage === 'local') {
      options = {
        region: 'localhost',
        endpoint: 'http://localhost:8100',
      };
    }

    this.tableName = createTableName(tableSuffix, serviceName, stage);
    this.serviceName = serviceName;
    this.stage = stage;

    this.model = define<T>(this.tableName, {
      tableName: this.tableName,
      hashKey,
      rangeKey,
      schema,
      indexes,
      timestamps: true,
    });

    this.model.config({ dynamodb: new AWS.DynamoDB(options) });
  }

  public matches(fullTableName: string): boolean {
    return fullTableName === createTableName(this.tableName, this.serviceName, this.stage);
  }
}

export const unmarshallDynamoDBImage = <T>(
  image: { [key: string]: AttributeValue },
  options?: Converter.ConverterOptions,
): T => {
  return AWS.DynamoDB.Converter.unmarshall(image, options) as T;
};

export interface UnmarshalledStreamRecord extends StreamRecord {
  New?: any;
  Old?: any;
}

export interface UnmarshalledDynamoDBRecord extends DynamoDBRecord {
  dynamodb?: UnmarshalledStreamRecord;
}

export interface UnmarshalledDynamoDBStreamEvent extends DynamoDBStreamEvent {
  Records: UnmarshalledDynamoDBRecord[];
}

export const dynamoDBStreamEventRequestMapper = (path: string, id = PROCESS_UUID) => {
  return (container: { event: UnmarshalledDynamoDBStreamEvent }): HttpRequestBase => {
    return {
      hostname: 'lambda.amazonaws.com', // TODO: Is there a dynamodb stream events namespace?
      method: 'POST',
      path,
      headers: {
        'X-Process-Uuid': id,
      },
      body: container.event.Records.map((record) => {
        if (!record.dynamodb) {
          return record;
        }
        record.dynamodb.New = record.dynamodb.NewImage ? unmarshallDynamoDBImage(record.dynamodb.NewImage) : undefined;
        record.dynamodb.Old = record.dynamodb.OldImage ? unmarshallDynamoDBImage(record.dynamodb.OldImage) : undefined;
        return record;
      }),
    };
  };
};

export const dynamoDBStreamEventResponseMapper = () => () => {};

export { Model };
