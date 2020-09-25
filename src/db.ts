import { v4 as uuidv4 } from 'uuid';
import { HttpError } from './errors';
import AWS from './aws';

const tableMetadata: { [key: string]: AWS.DynamoDB.TableDescription | undefined } = {};

const createTableName = (tableName: string, service: string, stage = 'local') => {
  return `${stage}-${service}-${tableName}`;
};

const prime = (row: any, id?: string) => {
  const now = new Date().getTime();
  const primed = row;
  if (!primed.id) {
    if (!id) {
      primed.id = uuidv4();
    } else {
      primed.id = id;
    }
  }

  if (!primed.created_at) {
    primed.created_at = now;
  }

  primed.updated_at = now;

  return primed;
};

const updateExpression = (item: any, keys = ['id']) => {
  let exp: string | undefined;

  Object.keys(item).forEach(key => {
    if (keys.includes(key)) {
      return;
    }

    if (!exp) {
      exp = 'set ';
    } else {
      exp += ', ';
    }

    exp += `#${key} = :${key}`;
  });

  console.log(`UPDATE EXPRESSION: ${exp}`);
  return exp;
};

const filterExpression = (item: any) => {
  let exp: string | undefined;

  Object.keys(item).forEach(e => {
    if (!exp) {
      exp = '';
    } else {
      exp += ' and ';
    }

    exp += `${e} = :${e}`;
  });

  console.log(`FILTER EXPRESSION: ${exp}`);
  return exp;
};

const attributeNames = (item: any, includeKeys = true, keys = ['id']) => {
  const names: any = {};
  Object.keys(item).forEach(key => {
    if (!includeKeys && keys.includes(key)) {
      return;
    }
    names[`#${key}`] = key;
  });
  console.log('Attribute names: ', names);
  return names;
};

const attributeValues = (item: any, includeKeys = true, keys = ['id']) => {
  const values: any = {};
  Object.keys(item).forEach(key => {
    if (!includeKeys && keys.includes(key)) {
      return;
    }
    values[`:${key}`] = item[key];
  });
  console.log('Attribute Values: ', values);
  return values;
};

const filterExpressionIn = (keyName: string, values: string[]) => {
  let exp: string = '';

  values.forEach((value, i) => {
    if (!exp) {
      exp = `#${keyName} in (`;
    } else {
      exp += ', ';
    }

    exp += `:${keyName}${i}`;
  });

  if (exp.length > 0) {
    exp += ')';
  }

  return exp;
};

const attributeValuesIn = (keyName: string, values: string[]) => {
  const valuesObj: { [key: string]: string } = {};

  values.forEach((value, i) => {
    valuesObj[`:${keyName}${i}`] = value;
  });

  return valuesObj;
};

const get = async (db: AWS.DynamoDB.DocumentClient, table: string, id: string, consistentRead = false) => {
  console.log(`Fetching ${id} from ${table}`);
  try {
    const response = await db
      .get({
        TableName: table,
        Key: {
          id,
        },
        ConsistentRead: consistentRead,
      })
      .promise();

    console.log(`${response.Item ? '1' : '0'} rows found with ID ${id}`);
    return response.Item;
  } catch (e) {
    throw new HttpError(500, `Unable to get: ${JSON.stringify(id)}: ${e.message}`);
  }
};

const listRange = async (
  db: AWS.DynamoDB.DocumentClient,
  dbClassic: AWS.DynamoDB,
  table: string,
  id: string,
  rangeMin: any,
  rangeMax: any,
  consistentRead = false,
) => {
  try {
    const rangeName = await getKeyName(dbClassic, table, 'RANGE');
    let keyConditionExpression = `#id = :id`;
    const expressionAttributeNames: { [key: string]: any } = { '#id': 'id' };
    const expressionAttributeValues: { [key: string]: any } = { ':id': id };

    if (rangeMin) {
      keyConditionExpression = `${keyConditionExpression} and #${rangeName} >= :rangeMin`;
      expressionAttributeNames[`#${rangeName}`] = rangeName;
      expressionAttributeValues[`:rangeMin`] = rangeMin;
    }

    if (rangeMax) {
      keyConditionExpression = `${keyConditionExpression} and #${rangeName} <= :rangeMax`;
      expressionAttributeNames[`#${rangeName}`] = rangeName;
      expressionAttributeValues[`:rangeMax`] = rangeMax;
    }

    const response = await db
      .query({
        TableName: table,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
      .promise();

    return response.Items;
  } catch (e) {
    throw new HttpError(500, `Unable to list with ID ${id} rangeMin ${rangeMin} rangeMax ${rangeMax}: ${e.message}`);
  }
};

const scanWithIndex = async (
  db: AWS.DynamoDB.DocumentClient,
  dbClassic: AWS.DynamoDB,
  table: string,
  index: string,
  keys: string[],
  consistentRead = false,
) => {
  try {
    const keyName = await getKeyName(dbClassic, table, 'HASH', index);
    const expressionAttributeNames: { [key: string]: string } = {};
    expressionAttributeNames[`#${keyName}`] = keyName;
    const response = await db
      .scan({
        TableName: table,
        IndexName: index,
        FilterExpression: filterExpressionIn(keyName, keys),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: attributeValuesIn(keyName, keys),
        ConsistentRead: consistentRead,
      })
      .promise();

    console.log(`Fetched ${response.Count} rows matching on index ${index}`);
    return response.Items;
  } catch (e) {
    throw new HttpError(500, `Unable to scan for key using index ${index}: ${e.message}`);
  }
};

const listWithIndex = async (
  db: AWS.DynamoDB.DocumentClient,
  dbClassic: AWS.DynamoDB,
  table: string,
  index: string,
  key: string,
  ascending = true,
  consistentRead = false,
) => {
  try {
    const keyName = await getKeyName(dbClassic, table, 'HASH', index);
    const expressionAttributeNames: { [key: string]: string } = {};
    expressionAttributeNames[`#${keyName}`] = keyName;
    const expressionAttributeValues: { [key: string]: string } = {};
    expressionAttributeValues[`:${keyName}`] = key;
    const response = await db
      .query({
        TableName: table,
        IndexName: index,
        KeyConditionExpression: `#${keyName} = :${keyName}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ScanIndexForward: ascending,
        ConsistentRead: consistentRead,
      })
      .promise();

    console.log(`Fetched ${response.Count} rows matching on index ${index}`);
    return response.Items;
  } catch (e) {
    throw new HttpError(500, `Unable to scan for key using index ${index}: ${e.message}`);
  }
};

const scan = async (db: AWS.DynamoDB.DocumentClient, table: string, obj: any, consistentRead = false) => {
  try {
    const response = await db
      .scan({
        TableName: table,
        FilterExpression: filterExpression(obj),
        ExpressionAttributeValues: attributeValues(obj),
        ConsistentRead: consistentRead,
      })
      .promise();

    console.log(`Fetched ${response.Count} rows matching: ${JSON.stringify(obj)}`);
    return response.Items;
  } catch (e) {
    throw new HttpError(500, `Unable to get: ${JSON.stringify(obj)}: ${e.message}`);
  }
};

const upsert = async (db: AWS.DynamoDB.DocumentClient, table: string, row: any, id?: string) => {
  const primed = prime(row, id);

  try {
    const response = await db
      .update({
        TableName: table,
        Key: {
          id: primed.id,
        },
        UpdateExpression: updateExpression(primed),
        ConditionExpression: 'attribute_not_exists(#id) OR #id = :id',
        ExpressionAttributeNames: attributeNames(primed),
        ExpressionAttributeValues: attributeValues(primed),
        ReturnValues: 'ALL_NEW',
      })
      .promise();

    console.log(`Upserted row: ${JSON.stringify(response)}`);
    return response.Attributes;
  } catch (e) {
    throw new HttpError(400, `Unable to upsert: ${e.message}`);
  }
};

const insert = async (db: AWS.DynamoDB.DocumentClient, table: string, row: any, id?: string, rangeKey?: string) => {
  const primed = prime(row, id);

  try {
    const key: { [key: string]: string } = {
      id: primed.id,
    };
    let conditionExpression = 'attribute_not_exists(id)';

    if (rangeKey) {
      key[rangeKey] = primed[rangeKey];
      conditionExpression = `${conditionExpression} and attribute_not_exists(${rangeKey})`;
    }

    const response = await db
      .update({
        TableName: table,
        Key: key,
        UpdateExpression: updateExpression(primed, Object.keys(key)),
        ConditionExpression: conditionExpression,
        ExpressionAttributeNames: attributeNames(primed, false, Object.keys(key)),
        ExpressionAttributeValues: attributeValues(primed, false, Object.keys(key)),
        ReturnValues: 'ALL_NEW',
      })
      .promise();

    console.log(`Inserted row: ${JSON.stringify(response)}`);
    return response.Attributes;
  } catch (e) {
    throw new HttpError(400, `Unable to insert: ${e.message}`);
  }
};

const getTableMetadata = async (db: AWS.DynamoDB, table: string) => {
  const metadata = tableMetadata[table];

  if (metadata) {
    return metadata;
  }

  try {
    const response = await db
      .describeTable({
        TableName: table,
      })
      .promise();

    tableMetadata[table] = response.Table;

    return tableMetadata[table];
  } catch (e) {
    throw new HttpError(500, `Unable to fetch table metadata: ${e.message}`);
  }
};

const getKeyName = async (db: AWS.DynamoDB, table: string, type: string, index?: string) => {
  const metadata = await getTableMetadata(db, table);

  if (!metadata) {
    throw new HttpError(500, `Unknown table metadata: ${table}`);
  }

  let keySchema = metadata.KeySchema;

  if (index) {
    const indexes = metadata?.GlobalSecondaryIndexes;

    if (!indexes) {
      throw new HttpError(500, `Table has no indexes: ${table}`);
    }

    const globalIndex = indexes.find(item => item.IndexName === index);

    if (!globalIndex) {
      throw new HttpError(500, `Index not found: ${table} ${index}`);
    }

    keySchema = globalIndex.KeySchema;
  }

  if (!keySchema) {
    throw new HttpError(500, `Key Schema not found: ${table} ${index}`);
  }

  const key = keySchema.find(k => k.KeyType === type);

  if (!key) {
    throw new HttpError(500, `Unable to find ${type} key: ${table} ${index}`);
  }

  return key.AttributeName;
};

export default class Table {
  tableName: string;
  db: AWS.DynamoDB.DocumentClient;
  dbClassic: AWS.DynamoDB;
  constructor(tableName: string, service: string, stage: string) {
    let options = {};
    if (stage === 'local') {
      options = {
        region: 'localhost',
        endpoint: 'http://localhost:8100',
      };
    }
    this.tableName = createTableName(tableName, service, stage);
    this.db = new AWS.DynamoDB.DocumentClient(options);
    this.dbClassic = new AWS.DynamoDB(options);
  }

  async get(id: string, consistentRead = false) {
    const ret = await get(this.db, this.tableName, id, consistentRead);
    return ret;
  }

  async listRange(id: string, rangeMin: any, rangeMax: any, consistentRead = false) {
    const ret = await listRange(this.db, this.dbClassic, this.tableName, id, rangeMin, rangeMax, consistentRead);
    return ret;
  }

  async upsert(row: any, id?: string) {
    const ret = await upsert(this.db, this.tableName, row, id);
    return ret;
  }

  async insert(row: any, id?: string, rangeKey?: string) {
    const ret = await insert(this.db, this.tableName, row, id, rangeKey);
    return ret;
  }

  async scan(obj: any, consistentRead = false) {
    const ret = await scan(this.db, this.tableName, obj, consistentRead);
    return ret;
  }

  async scanWithIndex(index: string, keys: string[], consistentRead = false) {
    const ret = await scanWithIndex(this.db, this.dbClassic, this.tableName, index, keys, consistentRead);
    return ret;
  }

  async listWithIndex(index: string, key: string, ascending = true, consistentRead = false) {
    const ret = await listWithIndex(this.db, this.dbClassic, this.tableName, index, key, ascending, consistentRead);
    return ret;
  }
}
