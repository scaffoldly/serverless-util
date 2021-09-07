import { HttpError } from './errors';
import { JWT } from 'jose';
import axios from 'axios';

import crypto from 'crypto';
import moment, { Moment } from 'moment';
import { BaseJwtPayload, HttpRequest } from './interfaces';
import { extractAuthorization, extractToken } from './http';
import { STAGE } from './constants';

export const URN_PREFIX = 'urn';
export const AUTH_AUDIENCE_PROVIDER = 'auth';
export const AUTH_PREFIXES = ['Bearer', 'jwt', 'Token'];

// TODO: External shared cache
const authCache: { [key: string]: { payload: BaseJwtPayload; expires: Moment } } = {};

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

export const cookieDomain = (httpRequest: HttpRequest) => {
  const host = httpRequest.header('host');
  if (!host) {
    throw new HttpError(400, 'Missing host header');
  }
  return host.split(':')[0];
};

export const cookiePrefix = (name: string) => {
  if (STAGE === 'local') {
    return name;
  }

  return `__Secure-${name}`;
};

export const cookieSecure = () => {
  if (STAGE === 'local') {
    return false;
  }

  return true;
};

export const cookieSameSite = () => {
  if (STAGE === 'local') {
    return 'lax';
  }
  return 'none';
};

export const generateSubject = (audience: string, userId: string): string => `${audience}:${userId}`;

export const generateAudience = (domain: string, provider: string): string => `${URN_PREFIX}:${provider}:${domain}`;

export const extractUserId = (jwtPayload: BaseJwtPayload, defaultOnAbsent?: string): string => {
  if (!jwtPayload || !jwtPayload.sub) {
    if (defaultOnAbsent) {
      console.warn(`Missing JWT payload, returning default: ${defaultOnAbsent}`);
      return defaultOnAbsent;
    }
    throw new HttpError(400, 'Missing id from JWT payload', jwtPayload);
  }

  return jwtPayload.sub.split(':').slice(-1)[0];
};

export const parseUrn = (urn: string): { prefix?: string; domain?: string; provider?: string } => {
  if (!urn) {
    console.warn('Missing urn');
    return {};
  }

  const parts = urn.split(':');
  if (parts.length < 3) {
    console.warn('Unable to parse urn:', parts);
    return {};
  }

  const [prefix, provider, domain] = parts;

  if (!prefix) {
    console.warn('Unable to find prefix in urn');
    return {};
  }

  if (!provider) {
    console.warn('Unable to find provider in urn');
    return { prefix };
  }

  if (!domain) {
    console.warn('Unable to find domain in urn');
    return { prefix, provider };
  }

  return { prefix, provider, domain };
};

export const verifyAudience = (domain: string, aud: string): boolean => {
  if (!aud) {
    console.warn('Missing audience');
    return false;
  }

  const { prefix, provider, domain: checkDomain } = parseUrn(aud);

  if (prefix !== URN_PREFIX) {
    console.warn(`Urn prefix mismatch. Got ${prefix}, expected ${URN_PREFIX}`);
    return false;
  }

  if (provider !== AUTH_AUDIENCE_PROVIDER) {
    console.warn(`Provider mismatch. Got ${provider}, expected ${AUTH_AUDIENCE_PROVIDER}`);
  }

  if (!checkDomain) {
    console.warn('Unable to find domain in audience');
    return false;
  }

  if (checkDomain === domain) {
    return true;
  }

  console.warn(`Domain mismatch. Got ${checkDomain}, expected ${domain}`);
  return false;
};

// TODO Lambda Authorizer
export function authorize(domain?: string) {
  // TODO: Support Scopes
  return async (request: HttpRequest, securityName: string, _scopes?: string[]): Promise<BaseJwtPayload> => {
    if (securityName !== 'jwt') {
      throw new Error(`Unsupported Security Name: ${securityName}`);
    }

    const authorization = extractAuthorization(request);
    if (!authorization) {
      throw new HttpError(401, 'Unauthorized');
    }

    const token = extractToken(authorization);
    if (!token) {
      throw new HttpError(400, 'Unable to extract token');
    }

    const decoded = JWT.decode(token) as BaseJwtPayload;
    if (!decoded) {
      throw new HttpError(400, 'Unable to decode token');
    }

    if (domain && !verifyAudience(domain, decoded.aud)) {
      throw new HttpError(401, 'Unauthorized');
    }

    const cacheKey = createCacheKey(token, request);

    if (authCache[cacheKey.key]) {
      const { expires, payload } = authCache[cacheKey.key];
      if (moment().isBefore(expires)) {
        console.log(`Returning cached payload for ${payload.aud} (expires: ${expires}; cacheKey: ${cacheKey})`);
        return payload;
      }
    }

    const { iss } = decoded;
    if (!iss) {
      throw new Error('Missing issuer in token payload');
    }

    console.log(`Authorizing ${decoded.sub} externally to ${iss}`);

    const { data: payload } = await axios.post(iss, { token });

    console.log(`Authorization response`, payload);

    const ret = payload as BaseJwtPayload;

    authCache[cacheKey.key] = { payload, expires: moment(ret.exp * 1000) };

    return authCache[cacheKey.key].payload;
  };
}
