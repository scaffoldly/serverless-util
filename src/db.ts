import * as dynamo from 'dynamodb';
import * as Joi from 'joi';
import { AWS, _AWS } from './aws';

const createTableName = (tableName: string, service: string, stage = 'local') => {
  return `${stage}-${service}-${tableName}`;
};

export class Table {
  readonly model: typeof dynamo.Model;
  constructor(
    tableName: string,
    service: string,
    stage: string,
    schema: {
      [key: string]: Joi.AnySchema | { [key: string]: Joi.AnySchema };
    },
    hashKey: string,
    rangeKey?: string,
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

    this.model = dynamo.define(tableName, {
      tableName: createTableName(tableName, service, stage),
      hashKey,
      rangeKey,
      schema,
      timestamps: true,
    });

    this.model.config({ dynamodb: new aws.DynamoDB(options) });
  }
}

export { Joi };
