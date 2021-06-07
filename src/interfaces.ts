import express from 'express';

export type ExpressRequest = express.Request;
export type ExpressResponse = express.Response;

// Generic type to support multiple server types (Express, etc)
export type HttpRequestBase = {
  headers: Record<string, string>;
  path: string;
  hostname: string;
};

export type HttpRequest = HttpRequestBase & express.Request;

export interface ErrorResponseTracking {
  method: string;
  path: string;
  version: string;
  source: string;
}

export interface ErrorResponse {
  message: string;
  traceId: string;
  tracking: ErrorResponseTracking;
  context?: { [key: string]: unknown };
}

export type CleansedObject = { [key: string]: string | number | boolean | undefined };

export interface JwtPayload extends CleansedObject {
  id: string;
  sk: string;
  refreshUrl: string;
  authorizeUrl: string;
  certsUrl: string;
}

export interface DecodedJwtPayload extends JwtPayload {
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

export type HttpRequestWithUser = HttpRequest & { user: DecodedJwtPayload };
