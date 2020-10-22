import * as dynamo from 'dynamodb';
import * as Joi from 'joi';
import { AWS, _AWS } from './aws';
import { SERVICE_NAME, STAGE } from './constants';

const createTableName = (tableName: string, serviceName: string, stage: string) => {
  return `${stage}-${serviceName}-${tableName}`;
};

export class Table {
  readonly model: typeof dynamo.Model;
  constructor(
    tableName: string,
    serviceName = SERVICE_NAME,
    stage = STAGE,
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
      tableName: createTableName(tableName, serviceName, stage),
      hashKey,
      rangeKey,
      schema,
      timestamps: true,
    });

    this.model.config({ dynamodb: new aws.DynamoDB(options) });
  }
}

export { Joi };
