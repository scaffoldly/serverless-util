import { HttpError } from './errors';
import { JWT } from 'jose';
import axios from 'axios';

import crypto from 'crypto';
import moment, { Moment } from 'moment';
import { HttpRequest } from './interfaces';
import { extractAuthorization, extractToken } from './http';

interface Payload {
  id: string;
  sk: string;
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  refreshUrl: string;
  authorizeUrl: string;
  certsUrl: string;
}

export const AUTH_PREFIXES = ['Bearer', 'jwt', 'Token'];

const authCache: { [key: string]: { payload: Payload; expires: Moment } } = {};

const createCacheKey = (token: string, request: HttpRequest): { key: string; method: string; path: string } => {
  const key = {
    token,
    method: request.method,
    path: request.path,
  };
  const sha = crypto.createHash('sha1');
  sha.update(JSON.stringify(key));

  return { key: sha.digest('base64'), method: key.method, path: key.path };
};

export async function authorize(
  request: HttpRequest,
  securityName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _scopes?: string[],
): Promise<Payload> {
  if (securityName !== 'jwt') {
    throw new Error(`Unsupported Security Name: ${securityName}`);
  }

  const authorization = extractAuthorization(request);
  if (!authorization) {
    throw new HttpError(401, 'Missing authorization header');
  }

  const token = extractToken(authorization);
  if (!token) {
    throw new Error('Unable to extract token');
  }

  const decoded = JWT.decode(token) as Payload;
  if (!decoded) {
    throw new Error('Unable to decode token');
  }

  const cacheKey = createCacheKey(token, request);

  if (authCache[cacheKey.key]) {
    const { expires, payload } = authCache[cacheKey.key];
    if (moment().isBefore(expires)) {
      console.log(`Returning cached payload for ${payload.aud} (expires: ${expires}; cacheKey: ${cacheKey})`);
      return payload;
    }
  }

  const { authorizeUrl } = decoded;
  if (!authorizeUrl) {
    throw new Error('Missing authorizeUrl in token payload');
  }

  console.log(`Authorizing ${decoded.aud} externally to ${authorizeUrl}`);

  const { data } = await axios.post(authorizeUrl, {
    token,
  });

  console.log(`Authorization response`, data);

  const { authorized, payload, error } = data;

  if (error) {
    throw error;
  }

  if (!authorized) {
    throw new Error('Unauthorized');
  }

  const ret = payload as Payload;

  authCache[cacheKey.key] = { payload, expires: moment(ret.exp * 1000) };

  return authCache[cacheKey.key].payload;
}
