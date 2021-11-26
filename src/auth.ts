import { HttpError } from './errors';
import { JWT } from 'jose';
import Axios from 'axios';

import crypto from 'crypto';
import moment, { Moment } from 'moment';
import { BaseJwtPayload, HttpRequest } from './interfaces';
import { extractAuthorization, extractToken } from './http';
import { STAGE } from './constants';

export const URN_PREFIX = 'urn';
export const DEFAULT_PROVIDER = 'auth';
export const AUTH_PREFIXES = ['Bearer', 'jwt', 'Token'];

export type AuthorizeTokenParams = {
  token: string;
  providers: string[];
  domain?: string;
  method?: string;
  path?: string;
};

// TODO: External shared cache
const authCache: { [key: string]: { payload: BaseJwtPayload; expires: Moment } } = {};

const createCacheKey = (
  token: string,
  method?: string,
  path?: string,
): { key: string; method: string; path: string } => {
  const key = {
    token,
    method: method || '*',
    path: path || '*',
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

export const verifyAudience = (providers: string[], domain: string, aud: string): boolean => {
  if (!aud) {
    console.warn('Missing audience');
    return false;
  }

  const { prefix, provider: checkProvider, domain: checkDomain } = parseUrn(aud);

  if (prefix !== URN_PREFIX) {
    console.warn(`Urn prefix mismatch. Got ${prefix}, expected ${URN_PREFIX}`);
    return false;
  }

  if (providers.length && checkProvider && !providers.includes(checkProvider)) {
    console.warn(`Provider mismatch. Got ${checkProvider}, expected one of ${providers}`);
    return false;
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

export const verifyIssuer = (domain: string, iss: string): boolean => {
  if (!domain) {
    console.warn('Missing domain');
    return false;
  }
  if (!iss) {
    console.warn('Missing issuer');
    return false;
  }

  const issuerUrl = new URL(iss);

  if (issuerUrl.hostname.endsWith(domain)) {
    return true;
  }

  console.warn('Invalid issuer', domain, iss);
  return false;
};

export const authorizeToken = async ({ providers, token, domain, method, path }: AuthorizeTokenParams) => {
  const decoded = JWT.decode(token) as BaseJwtPayload;
  if (!decoded) {
    throw new HttpError(400, 'Unable to decode token');
  }

  if (domain && !verifyAudience(providers, domain, decoded.aud)) {
    throw new HttpError(401, 'Unauthorized');
  }

  const cacheKey = createCacheKey(token, method, path);

  if (authCache[cacheKey.key]) {
    const { expires, payload } = authCache[cacheKey.key];
    if (moment().isBefore(expires)) {
      console.log(`Returning cached payload for ${payload.aud} (expires: ${expires}; cacheKey: ${cacheKey})`);
      return payload;
    }
  }

  const { iss } = decoded;
  if (!iss) {
    throw new HttpError(400, 'Missing issuer in token payload', decoded);
  }

  if (domain && !verifyIssuer(domain, iss)) {
    throw new HttpError(401, 'Unauthorized', { domain, iss });
  }

  console.log(`Authorizing ${decoded.sub} externally to ${iss}`);

  try {
    const { data: payload } = await Axios.post(iss, { token });

    console.log(`Authorization response`, payload);

    const ret = payload as BaseJwtPayload;

    authCache[cacheKey.key] = { payload, expires: moment(ret.exp * 1000) };

    return authCache[cacheKey.key].payload;
  } catch (e: any) {
    if (Axios.isAxiosError(e) && e.response && e.response.status) {
      if (e.response.status === 401) {
        throw new HttpError(e.response.status, 'Unauthorized', {
          url: iss,
          status: e.response.status,
          message: e.message,
        });
      }
      throw new HttpError(500, 'Error authorizing token', { url: iss, status: e.response.status, message: e.message });
    }
    throw new HttpError(500, 'Error authroizing token', { message: e.message });
  }
};

// TODO Lambda Authorizer
export function authorize(domain?: string, providers = [DEFAULT_PROVIDER]) {
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

    return authorizeToken({ providers, token, domain, method: request.method, path: request.path });
  };
}
