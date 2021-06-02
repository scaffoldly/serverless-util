import { define, Model } from 'dynamodb';
import Joi from 'joi';
import { AWS } from './aws';
import { SERVICE_NAME, STAGE } from './constants';

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

export { Joi, Model };
