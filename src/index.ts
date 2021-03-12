import { HttpError } from './errors';
import { STAGE } from './constants';
import { AWSXRay } from './aws';
import { JWT } from 'jose';
import {
  HandleSuccessOptions,
  HandleErrorOptions,
  OptionalParametersOptions,
  ExtractAuthorizationOptions,
  ExtractedAuthorizations,
} from './types';

import http = require('http');
import { createHeaders } from './util';

if (STAGE !== 'local') {
  AWSXRay.captureHTTPsGlobal(http, true);
}

export const extractAuthorization = (event: any, options?: ExtractAuthorizationOptions): ExtractedAuthorizations => {
  const extracted: ExtractedAuthorizations = {};

  if (event.requestContext.identity.apiKey && event.headers['X-API-KEY']) {
    extracted.apikey = {
      token: event.requestContext.identity.apiKey,
      context: event.requestContext.identity,
    };
  }

  if (event.requestContext.authorizer && event.headers['Authorization']) {
    try {
      const token = event.headers['Authorization'].split(' ')[1];
      JWT.decode(token); // Throws an error if not decodable JWT
      extracted.jwt = {
        token: token,
        context: event.requestContext.authorizer,
      };
    } catch (e) {}
  }

  if (options?.throwError && !extracted.apikey && !extracted.jwt) {
    throw new HttpError(401, 'Unauthorized');
  }

  return extracted;
};

export const handleSuccess = (event: any, body = {}, options?: HandleSuccessOptions) => {
  return {
    statusCode: options && options.statusCode ? options.statusCode : 200,
    headers: createHeaders(event, options && options.headers ? options.headers : {}),
    body: body ? JSON.stringify(body) : undefined,
  };
};

export const handleError = (event: any, error: any, options?: HandleErrorOptions) => {
  let status = options && options.statusCode ? options.statusCode : 500;
  if (error instanceof HttpError) {
    return error.response(event, options && options.headers ? options.headers : {});
  }

  // Generic HTTP errors (e.g. AWS Errors)
  if (error && error.statusCode) {
    status = error.statusCode;
  }

  const context = options && options.context ? options.context : {};

  return new HttpError(status, error.message || (typeof error === 'string' ? error : JSON.stringify(error)), {
    reason: error,
    ...context,
  }).response(event, options && options.headers ? options.headers : {});
};

export const requiredParameters = (obj: any, parameterNames: string[]) => {
  const params: any = {};

  if (!obj) {
    throw new HttpError(422, `Missing required parameters: ${parameterNames}`);
  }

  let json: any;
  if (typeof obj === 'string') {
    try {
      json = JSON.parse(obj);
    } catch (e) {
      throw new HttpError(422, `Unable to parse body: ${obj}`);
    }
  } else {
    json = obj;
  }

  parameterNames.forEach(key => {
    if (!json[key]) {
      throw new HttpError(400, `Missing required parameters: ${key}`);
    }

    params[key] = json[key];
  });

  return params;
};

export const optionalParameters = (obj: any, parameterNames: string[], options?: OptionalParametersOptions) => {
  const params: any = {};

  if (!obj) {
    return {};
  }

  let json: any;
  if (typeof obj === 'string') {
    try {
      json = JSON.parse(obj);
    } catch (e) {
      return {};
    }
  } else {
    json = obj;
  }

  parameterNames.forEach(key => {
    if (json[key] || (options && options.allowEmptyStrings && json[key] === '')) {
      params[key] = json[key];
    }
  });

  if (options && options.requreAtLeastOne && Object.keys(params).length === 0) {
    throw new HttpError(400, `Missing one of the required parameters: expected one of ${parameterNames}`);
  }

  return params;
};

export { Table, TableIndex, TableUuid, Joi } from './db';
export { AWS } from './aws';
export { GetSecret, SetSecret } from './secrets';
export { HttpError } from './errors';
export { SERVICE_NAME, STAGE } from './constants';
