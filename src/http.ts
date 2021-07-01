import { AUTH_PREFIXES } from './auth';
import { HttpError } from './errors';
import { HttpRequest } from './interfaces';

export const constructServiceUrl = (request: HttpRequest, serviceName?: string, path?: string): string => {
  const { headers } = request;
  const { host } = headers;
  const ssl = headers['x-forwarded-proto'] === 'https';

  // TODO Use URI Builder
  return `${ssl ? 'https' : 'http'}://${host}${serviceName ? `/${serviceName}` : ''}${path ? path : ''}`;
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
