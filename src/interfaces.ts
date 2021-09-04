import express from 'express';

export type ExpressRequest = express.Request;
export type ExpressResponse = express.Response;

// Generic type to support multiple server types (Express, etc)
export type HttpRequestBase = {
  method: string;
  headers: Record<string, string>;
  path: string;
  hostname: string;
  body?: any;
};

export type HttpRequest = HttpRequestBase & express.Request;

export interface ErrorResponseTracking {
  method: string;
  path: string;
  version: string;
}

export interface ErrorResponse {
  message: string;
  traceId: string;
  tracking: ErrorResponseTracking;
  context?: { [key: string]: unknown };
}

export type CleansedObject = { [key: string]: string | number | boolean };

export type BaseJwtPayload = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  nbf?: number;
  iat: number;
  jti: string;
};

export type HttpRequestWithUser = HttpRequest & { user: BaseJwtPayload };

export type TypedDynamoDBStreamRecord<T> = {
  Keys?: { [key: string]: any };
  New?: T;
  Old?: T;
};

export type TypedDynamoDBRecord<T> = {
  dynamodb: TypedDynamoDBStreamRecord<T>;
  eventID: string;
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  eventSourceARN: string;
  awsRegion: string;
  tableName: string;
};

export type TypedDynamoDBStreamEvent<T> = {
  Records: TypedDynamoDBRecord<T>[];
};

export type TypedSNSMessageAttribute = {
  Type: string;
  Value: string;
};

export type TypedSNSMessageAttributes = {
  [name: string]: TypedSNSMessageAttribute;
};

export type TypedSNSMessage<T> = {
  SignatureVersion: string;
  Timestamp: string;
  Signature: string;
  SigningCertUrl: string;
  MessageId: string;
  Message: string;
  MessageAttributes: TypedSNSMessageAttributes;
  Type: string;
  UnsubscribeUrl: string;
  TopicArn: string;
  Subject: string;
  Object: T;
  TopicName: string;
};

export type TypedSNSEventRecord<T> = {
  EventVersion: string;
  EventSubscriptionArn: string;
  EventSource: string;
  Sns: TypedSNSMessage<T>;
};

export type TypedSNSEvent<T> = {
  Records: TypedSNSEventRecord<T>[];
};
