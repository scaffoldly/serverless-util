import { define, Model } from '@scaffoldly/dynamodb';
import Joi from 'joi';
import { AWS } from './exports';
import { SERVICE_NAME, STAGE } from './constants';
import { AttributeValue, DynamoDBRecord, StreamRecord } from 'aws-lambda';
import { Converter } from 'aws-sdk/clients/dynamodb';
import { from_values as timeflake } from 'timeflake';
import BN from 'bn.js';
import seedrandom from 'seedrandom';
import { LOCALSTACK } from './exports/aws';
import { boolean } from 'boolean';

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
        region: process.env.AWS_DEFAULT_REGION || 'localhost',
        endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:8100',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'DEFAULT_ACCESS_KEY',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'DEFAULT_SECRET',
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

    let dynamodb = new AWS.DynamoDB(options);

    if (!boolean(LOCALSTACK)) {
      options = {
        endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
      };
    }

    this.model.config({ dynamodb });
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

export type StreamRecordHandlers<T, K = T> = {
  canHandle: HandleFn;
  onInsert?: (t: T) => Promise<T | K | null>;
  onModify?: (newT: T, oldT: T) => Promise<T | K | null>;
  onRemove?: (t: T) => Promise<T | K | null>;
};

export const handleDynamoDBStreamRecord = async <T, K = T>(
  record: DynamoDBRecord,
  handlers: StreamRecordHandlers<T, K>,
): Promise<T | K | null> => {
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

  return null;
};

const stringToId = <Version extends string, Namespace extends string>(
  value: string,
  version: Version,
  namespace: Namespace,
): string => {
  const timestamp = Math.abs(seedrandom(value).int32());
  const random = Math.abs(seedrandom(version).int32());
  const id = timeflake(new BN(timestamp), new BN(random));

  const suffix = STAGE !== 'live' ? STAGE : '';

  return `${version}.${namespace}${suffix}.${id.base62}`;
};

export { Model, stringToId };
