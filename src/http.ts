import { DynamoDBStreamEvent, SNSEvent } from 'aws-lambda';
import { AUTH_PREFIXES } from './auth';
import {
  MAPPED_EVENT_DYNAMODB_STREAM,
  MAPPED_EVENT_HEADER,
  MAPPED_EVENT_SNS,
  PROCESS_UUID,
  PROCESS_UUID_HEADER,
} from './constants';
import { dynamoDBStreamEventExtractTableName, unmarshallDynamoDBImage } from './db';
import { HttpError } from './errors';
import {
  HttpRequest,
  HttpRequestBase,
  TypedDynamoDBRecord,
  TypedDynamoDBStreamEvent,
  TypedSNSEvent,
  TypedSNSEventRecord,
} from './interfaces';

export const assertProcessUuid = (actual: string, expected = PROCESS_UUID): boolean => {
  if (!actual) {
    throw new Error('Missing Process UUID: actual is undefined');
  }
  if (!expected) {
    throw new Error('Missing Process UUID: expected is undefined');
  }
  if (!actual.toLowerCase) {
    throw new Error('Missing Process UUID: actual.toLowerCase is undefined');
  }
  if (!expected.toLowerCase) {
    throw new Error('Missing Process UUID: expected.toLowerCase is undefined');
  }

  if (actual.toLowerCase() === expected.toLowerCase()) {
    return true;
  }

  throw new Error(`Provided process UUID (${actual}) does not match expected process UUID`);
};

export const constructServiceUrl = (request: HttpRequest, serviceSlug?: string, path?: string): string => {
  const { headers } = request;
  const { host } = headers;
  const ssl = headers['x-forwarded-proto'] === 'https';

  let slug = serviceSlug ? `/${serviceSlug}` : '/';

  let actualPath = path || '';
  if (!actualPath.startsWith('/') && actualPath.length !== 0) {
    actualPath = `/${actualPath}`;
  }

  return `${ssl ? 'https' : 'http'}://${host}${slug}${actualPath}`;
};

export const extractAuthorization = (request: HttpRequest): string | null => {
  if (!request) {
    console.warn('Unable to extract authorization header: Request is null');
    return null;
  }

  const { headers } = request;
  if (!headers) {
    console.warn('Unable to extract authorization header: No headers');
    return null;
  }

  const { authorization } = headers;
  if (authorization) {
    return authorization;
  }

  const { Authorization } = headers;
  if (Authorization) {
    return Authorization;
  }

  console.warn("Missing header named 'Authorization' or 'authorization'");
  return null;
};

export const extractToken = (authorization: string): string | null => {
  if (!authorization) {
    console.warn('Missing authorization header');
    return null;
  }

  let token = authorization;

  const parts = token.split(' ');
  if (parts.length > 2) {
    console.warn('Malformed authorization header: Extra spaces');
    return null;
  }

  if (parts.length === 2) {
    const prefix = parts[0];
    if (AUTH_PREFIXES.indexOf(prefix) === -1) {
      console.warn(`Invalid token type: ${prefix}`);
      return null;
    }
    [, token] = parts;
  }

  return token;
};

export const extractRequestToken = (request: HttpRequest): string => {
  const authorization = extractAuthorization(request);
  if (!authorization) {
    throw new HttpError(401, 'Unauthorized');
  }

  const token = extractToken(authorization);
  if (!token) {
    throw new HttpError(401, 'Unauthorized');
  }

  return token;
};

export const dynamoDBStreamEventRequestMapper = (path: string, id = PROCESS_UUID) => {
  return (container: { event: DynamoDBStreamEvent }): HttpRequestBase => {
    const body: TypedDynamoDBStreamEvent<any> = {
      Records: container.event.Records.reduce<TypedDynamoDBRecord<any>[]>((acc, record) => {
        if (!record.dynamodb || !record.eventID || !record.eventName || !record.eventSourceARN || !record.awsRegion) {
          return acc;
        }

        const tableName = dynamoDBStreamEventExtractTableName(record.eventSourceARN);
        if (!tableName) {
          return acc;
        }

        acc.push({
          dynamodb: {
            Keys: record.dynamodb.Keys ? unmarshallDynamoDBImage(record.dynamodb.Keys) : undefined,
            New: record.dynamodb.NewImage ? unmarshallDynamoDBImage(record.dynamodb.NewImage) : undefined,
            Old: record.dynamodb.OldImage ? unmarshallDynamoDBImage(record.dynamodb.OldImage) : undefined,
          },
          eventID: record.eventID,
          eventName: record.eventName,
          eventSourceARN: record.eventSourceARN,
          awsRegion: record.awsRegion,
          tableName,
        });
        return acc;
      }, []),
    };

    return {
      hostname: 'dynamodb.amazonaws.com',
      method: 'POST',
      path,
      headers: {
        [PROCESS_UUID_HEADER]: id,
        [MAPPED_EVENT_HEADER]: MAPPED_EVENT_DYNAMODB_STREAM,
      },
      body,
    };
  };
};

export const snsExtractTopicName = (topicArn: string): string | undefined => {
  // TODO Proper ARN Parser
  if (!topicArn) {
    return;
  }
  const parts = topicArn.split(':');
  if (parts.length !== 6) {
    return;
  }
  return parts[5];
};

export const snsEventRequestMapper = (path: string, id = PROCESS_UUID) => {
  return (container: { event: SNSEvent }): HttpRequestBase => {
    const body: TypedSNSEvent<any> = {
      Records: container.event.Records.reduce<TypedSNSEventRecord<any>[]>((acc, record) => {
        const topicName = snsExtractTopicName(record.Sns.TopicArn);
        if (!topicName) {
          return acc;
        }

        // TODO Verify Signature
        let obj: any = undefined;
        try {
          obj = JSON.parse(record.Sns.Message);
        } catch (e) {
          console.warn('Unable to parse message into JSON');
        }

        acc.push({
          ...record,
          Sns: {
            ...record.Sns,
            Subject: record.Sns.Subject || '',
            Object: obj,
            TopicName: topicName,
          },
        });
        return acc;
      }, []),
    };

    return {
      hostname: 'sns.amazonaws.com',
      method: 'POST',
      path,
      headers: {
        [PROCESS_UUID_HEADER]: id,
        [MAPPED_EVENT_HEADER]: MAPPED_EVENT_SNS,
      },
      body,
    };
  };
};

const emptyResponseMapper = () => () => {};
export const dynamoDBStreamEventResponseMapper = emptyResponseMapper;
export const snsEventResponseMapper = emptyResponseMapper;
