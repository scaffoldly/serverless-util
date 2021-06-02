import { AUTH_PREFIXES } from './auth';
import { HttpRequest } from './interfaces';

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
