import { define, Model } from 'dynamodb';
import Joi from 'joi';
import { AWS } from './exports';
import { SERVICE_NAME, STAGE } from './constants';
import { APIGatewayProxyResult, DynamoDBStreamEvent } from 'aws-lambda';
import { HttpRequestBase } from './interfaces';
import { AttributeValue } from 'aws-sdk/clients/dynamodbstreams';
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

export const dynamoDBStreamEventRequestMapper = (path: string) => {
  return (container: DynamoDBStreamEventContainer): HttpRequestBase => {
    return {
      hostname: 'lambda.amazonaws.com', // TODO: Is there a dynamodb stream events namespace?
      method: 'POST',
      path,
      headers: {},
      body: container.event.Records,
    };
  };
};

export const dynamoDBStreamEventResponseMapper = () => (result: APIGatewayProxyResult) => result;

export const unmarshallDynamoDBImage = <T>(
  image: { [key: string]: AttributeValue },
  options?: Converter.ConverterOptions,
): T => {
  return AWS.DynamoDB.Converter.unmarshall(image, options) as T;
};

export { Model };
