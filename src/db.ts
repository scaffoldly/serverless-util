import { define, Model } from 'dynamodb';
import Joi from 'joi';
import { AWS } from './exports';
import { PROCESS_UUID, PROCESS_UUID_HEADER, SERVICE_NAME, STAGE } from './constants';
import { AttributeValue, DynamoDBStreamEvent } from 'aws-lambda';
import { HttpRequestBase, TypedDynamoDBRecord } from './interfaces';
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

export const dynamoDBStreamEventRequestMapper = (path: string, id = PROCESS_UUID) => {
  return (container: { event: DynamoDBStreamEvent }): HttpRequestBase => {
    return {
      hostname: 'lambda.amazonaws.com', // TODO: Is there a dynamodb stream events namespace?
      method: 'POST',
      path,
      headers: {
        [PROCESS_UUID_HEADER]: id,
      },
      body: container.event.Records.map<TypedDynamoDBRecord<any>>((record) => {
        if (!record.dynamodb) {
          return record as TypedDynamoDBRecord<any>;
        }
        return {
          dynamodb: {
            New: record.dynamodb.NewImage ? unmarshallDynamoDBImage(record.dynamodb.NewImage) : undefined,
            Old: record.dynamodb.OldImage ? unmarshallDynamoDBImage(record.dynamodb.OldImage) : undefined,
          },
          eventID: record.eventID,
          eventName: record.eventName,
        };
      }),
    };
  };
};

export const dynamoDBStreamEventResponseMapper = () => () => {};

export { Model };
