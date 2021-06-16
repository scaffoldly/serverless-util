import { HttpError } from './errors';
import { JWT } from 'jose';
import axios from 'axios';

import crypto from 'crypto';
import moment, { Moment } from 'moment';
import { DecodedJwtPayload, HttpRequest } from './interfaces';
import { extractAuthorization, extractToken } from './http';

export const URN_PREFIX = 'urn';
export const AUTH_PREFIXES = ['Bearer', 'jwt', 'Token'];

const authCache: { [key: string]: { payload: DecodedJwtPayload; expires: Moment } } = {};

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

export const generateAudience = (domain: string, id: string): string => `${URN_PREFIX}:auth:${domain}:${id}`;

export const verifyAudience = (domain: string, aud: string): boolean => {
  if (!aud) {
    console.warn('Missing audience');
    return false;
  }

  const parts = aud.split(':');
  if (parts.length < 4) {
    console.warn('Unable to parse audience:', parts);
    return false;
  }

  const [, , checkDomain] = parts;
  if (!checkDomain) {
    console.warn('Unable to find domain in audience');
  }

  if (checkDomain === domain) {
    return true;
  }

  console.warn(`Domain mismatch. Got ${checkDomain}, expected ${domain}`);
  return false;
};

export async function authorize(domain?: string) {
  // TODO: Support Scopes
  return async (request: HttpRequest, securityName: string, _scopes?: string[]): Promise<DecodedJwtPayload> => {
    if (securityName !== 'jwt') {
      throw new Error(`Unsupported Security Name: ${securityName}`);
    }

    const authorization = extractAuthorization(request);
    if (!authorization) {
      throw new HttpError(401, 'Missing authorization header');
    }

    const token = extractToken(authorization);
    if (!token) {
      throw new HttpError(400, 'Unable to extract token');
    }

    const decoded = JWT.decode(token) as DecodedJwtPayload;
    if (!decoded) {
      throw new HttpError(400, 'Unable to decode token');
    }

    if (domain && !verifyAudience(domain, decoded.aud)) {
      throw new HttpError(401, 'Audience mismatch');
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
      throw new HttpError(401, 'Unauthorized');
    }

    const ret = payload as DecodedJwtPayload;

    authCache[cacheKey.key] = { payload, expires: moment(ret.exp * 1000) };

    return authCache[cacheKey.key].payload;
  };
}
