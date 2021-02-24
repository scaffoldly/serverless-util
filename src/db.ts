import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { AttributeMap, DocumentClient } from 'aws-sdk/clients/dynamodb';
import DynamoDB = require('aws-sdk/clients/dynamodb');
import * as dynamo from 'dynamodb';
import * as Joi from 'joi';
import { AWS, _AWS } from './aws';
import { SERVICE_NAME, STAGE } from './constants';

const createTableName = (tableName: string, serviceName: string, stage: string) => {
  return `${stage}-${serviceName}-${tableName}`;
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
    tableName: string,
    serviceName = SERVICE_NAME,
    stage = STAGE,
    schema: {
      [key: string]: Joi.AnySchema | { [key: string]: Joi.AnySchema };
    },
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

    this.tableName = tableName;
    this.serviceName = serviceName;
    this.stage = stage;

    this.model = dynamo.define(tableName, {
      tableName: createTableName(tableName, serviceName, stage),
      hashKey,
      rangeKey,
      schema,
      indexes,
      timestamps: true,
    });

    this.model.config({ dynamodb: new aws.DynamoDB(options) });
  }

  matches(fullTableName: string) {
    return fullTableName === createTableName(this.tableName, this.serviceName, this.stage);
  }

  unmarshallDynamoDBStreamEvent = (
    event: DynamoDBStreamEvent,
    eventType: 'INSERT' | 'MODIFY' | 'REMOVE',
    recordType: 'NEW' | 'OLD',
  ) => {
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
      { items: [] as AttributeMap[], context: [] as DynamoDBRecord[], eventType, recordType },
    );
    return result;
  };
}

export { Joi };
