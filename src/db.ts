import { define, Model } from 'dynamodb';
import Joi from 'joi';
import { AWS } from './exports';
import { SERVICE_NAME, STAGE } from './constants';
import { AttributeValue, DynamoDBRecord, StreamRecord } from 'aws-lambda';
import { Converter } from 'aws-sdk/clients/dynamodb';

const createTableName = (tableSuffix: string, serviceName: string, stage: string) => {
  return `${stage}-${serviceName}${tableSuffix ? `-${tableSuffix}` : ''}`;
};

export interface TableIndex {
  hashKey: string;
  rangeKey?: string;
  name: string;
  type: 'local' | 'global';
}

export class Table<T> {
  readonly model: Model<T>;
  private tableSuffix: string;
  public readonly tableName: string;
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
    this.tableSuffix = tableSuffix;
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
    return fullTableName === createTableName(this.tableSuffix, this.serviceName, this.stage);
  }
}

export const dynamoDBStreamEventExtractTableName = (eventSourceARN: string): string | undefined => {
  if (!eventSourceARN) {
    return;
  }
  if (eventSourceARN.indexOf('/') === -1) {
    return eventSourceARN.split(':').slice(-1)[0];
  }
  const parts = eventSourceARN.split('/');
  if (parts.length !== 4) {
    return;
  }
  return parts[1];
};

export const unmarshallDynamoDBImage = <T>(
  image?: { [key: string]: AttributeValue },
  options?: Converter.ConverterOptions,
): T => {
  if (!image) {
    throw new Error('Unable to unmarshall an empty object');
  }
  return AWS.DynamoDB.Converter.unmarshall(image, options) as T;
};

export type HandleFn = (record: StreamRecord) => boolean;

export type StreamRecordHandlers<T> = {
  canHandle: HandleFn;
  onInsert?: (t: T) => Promise<T | undefined>;
  onModify?: (newT: T, oldT: T) => Promise<T | undefined>;
  onRemove?: (t: T) => Promise<T | undefined>;
};

export const handleDynamoDBStreamRecord = async <T>(
  record: DynamoDBRecord,
  handlers: StreamRecordHandlers<T>,
): Promise<T | undefined> => {
  if (!record || !record.dynamodb) {
    throw new Error('Invalid record');
  }
  if (handlers.canHandle(record.dynamodb)) {
    if (record.eventName === 'INSERT' && handlers.onInsert) {
      return handlers.onInsert(unmarshallDynamoDBImage(record.dynamodb.NewImage));
    }
    if (record.eventName === 'MODIFY' && handlers.onModify) {
      return handlers.onModify(
        unmarshallDynamoDBImage(record.dynamodb.NewImage),
        unmarshallDynamoDBImage(record.dynamodb.OldImage),
      );
    }
    if (record.eventName === 'REMOVE' && handlers.onRemove) {
      return handlers.onRemove(unmarshallDynamoDBImage(record.dynamodb.OldImage));
    }
  }

  return;
};

export { Model };
