import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';

import * as dynamo from 'dynamodb';
import * as Joi from 'joi';
import { AWS, _AWS } from './aws';
import { SERVICE_NAME, STAGE } from './constants';

const createTableName = (tableSuffix: string, serviceName: string, stage: string) => {
  return `${stage}-${serviceName}${tableSuffix ? `-${tableSuffix}` : ''}`;
};

export const TableUuid = (): Joi.AnySchema => {
  return dynamo.types.uuid();
};

export interface TableIndex {
  hashKey: string;
  rangeKey?: string;
  name: string;
  type: 'local' | 'global';
}

export class Table {
  readonly model: typeof dynamo.Model;
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
    let aws = AWS;
    let options = {};
    if (stage === 'local') {
      aws = _AWS;
      options = {
        region: 'localhost',
        endpoint: 'http://localhost:8100',
      };
    }

    this.tableName = createTableName(tableSuffix, serviceName, stage);
    this.serviceName = serviceName;
    this.stage = stage;

    this.model = dynamo.define(this.tableName, {
      tableName: this.tableName,
      hashKey,
      rangeKey,
      schema,
      indexes,
      timestamps: true,
    });

    this.model.config({ dynamodb: new aws.DynamoDB(options) });
  }

  matches(fullTableName: string): boolean {
    return fullTableName === createTableName(this.tableName, this.serviceName, this.stage);
  }

  unmarshallDynamoDBStreamEvent = (
    event: DynamoDBStreamEvent,
    eventType: 'INSERT' | 'MODIFY' | 'REMOVE',
    recordType: 'NEW' | 'OLD',
  ): {
    items: DynamoDB.AttributeMap[];
    context: DynamoDBRecord[];
    eventType: 'INSERT' | 'MODIFY' | 'REMOVE';
    recordType: 'NEW' | 'OLD';
  } => {
    const result = event.Records.reduce(
      (acc, record) => {
        if (!record.eventSourceARN || !record.dynamodb) {
          return acc;
        }

        if (record.eventName !== eventType) {
          return acc;
        }

        const fullTableName = record.eventSourceARN.split('/')[1];
        if (!this.matches(fullTableName)) {
          return acc;
        }

        if (recordType === 'NEW' && record.dynamodb.NewImage) {
          acc.items.push(DynamoDB.Converter.unmarshall(record.dynamodb.NewImage));
          delete record.dynamodb.NewImage;
          acc.context.push(record);
        }
        if (recordType === 'OLD' && record.dynamodb.OldImage) {
          acc.items.push(DynamoDB.Converter.unmarshall(record.dynamodb.OldImage));
          delete record.dynamodb.OldImage;
          acc.context.push(record);
        }

        return acc;
      },
      { items: [] as { [key: string]: any }[], context: [] as DynamoDBRecord[], eventType, recordType },
    );
    return result;
  };
}

export { Joi };
