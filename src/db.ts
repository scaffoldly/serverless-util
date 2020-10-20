import dynamo from 'dynamodb';
import { AnySchema } from 'joi';
import AWS from './aws';

const createTableName = (tableName: string, service: string, stage = 'local') => {
  return `${stage}-${service}-${tableName}`;
};

export default class Table {
  _model: typeof dynamo.Model;
  constructor(
    tableName: string,
    service: string,
    stage: string,
    schema: {
      [key: string]: AnySchema | { [key: string]: AnySchema };
    },
    hashKey: string,
    rangeKey?: string,
  ) {
    let options = {};
    if (stage === 'local') {
      options = {
        region: 'localhost',
        endpoint: 'http://localhost:8100',
      };
    }

    this._model = dynamo.define(createTableName(tableName, service, stage), {
      hashKey,
      rangeKey,
      schema,
      timestamps: true,
    });

    this._model.config({ dynamodb: new AWS.DynamoDB(options) });
  }

  model = () => this._model;
}
