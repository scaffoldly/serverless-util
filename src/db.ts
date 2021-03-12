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

export const TableUuid = () => {
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
  // private schema: Joi.ObjectSchema<any>;

  constructor(
    tableName: string,
    serviceName = SERVICE_NAME,
    stage = STAGE,
    hashKey: string,
    rangeKey?: string,
    indexes?: TableIndex[], // TODO VERIFY THIS WORKS
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

    // const schema = { id: Joi.string() };
    // if (rangeKey) {
    //   schema[rangeKey] = Joi.any().required();
    // }
    // this.schema = Joi.object(schema).unknown(true);
    // TODO Indexes

    // console.log('!!!! validating schema');
    // try {
    //   console.log('!!! schema', schema);
    //   const foo = Joi.object().keys(schema);
    //   console.log('!!!! foo', foo);
    // } catch (e) {
    //   console.error('!!!! error', e);
    // }

    try {
      // this.model = dynamo.define(tableName, {
      //   tableName: createTableName(tableName, serviceName, stage),
      //   hashKey: 'id',
      //   // rangeKey,
      //   schema: { id: Joi.string() },
      //   // indexes,
      //   // timestamps: true,
      // });
      this.model = dynamo.define('example-Account', {
        hashKey: 'name',
        rangeKey: 'email',
        schema: {
          name: Joi.string(),
          email: Joi.string(),
          age: Joi.number(),
        },
        indexes: [{ hashKey: 'name', rangeKey: 'age', type: 'local', name: 'NameAgeIndex' }],
      });
    } catch (e) {
      console.log('!!!! error', e);
      throw e;
    }

    // this.model = dynamo.define(tableName, {
    //   tableName: createTableName(tableName, serviceName, stage),
    //   hashKey,
    //   // rangeKey,
    //   schema: { id: Joi.string().required() },
    //   // indexes,
    //   // timestamps: true,
    // });

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
