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

export interface JwtPayloadBase extends CleansedObject {
  id: string;
  sk: string;
  refreshUrl: string;
  authorizeUrl: string;
  certsUrl: string;
  sessionId: string;
}

export interface DecodedJwtPayload extends JwtPayloadBase {
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

export type HttpRequestWithUser = HttpRequest & { user: DecodedJwtPayload };
