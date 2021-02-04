import { HttpError } from './errors';
import { STAGE } from './constants';
import { AWSXRay } from './aws';

import http = require('http');
import { createHeaders } from './util';

if (STAGE !== 'local') {
  AWSXRay.captureHTTPsGlobal(http, true);
}

export const handleSuccess = (event: any, body = {}, headers = {}, statusCode = 200) => {
  return {
    statusCode,
    headers: createHeaders(event, headers),
    body: JSON.stringify(body),
  };
};

export const handleError = (event: any, error: any, headers = {}, statusCode = 500) => {
  console.error('Handling error', error);

  let status = statusCode;
  if (error instanceof HttpError) {
    return error.response(event, headers);
  }

  // Generic HTTP errors (e.g. AWS Errors)
  if (error && error.statusCode) {
    status = error.statusCode;
  }

  return new HttpError(status, error.message || JSON.stringify(error), { reason: error }).response(event, headers);
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

export const optionalParameters = (
  obj: any,
  parameterNames: string[],
  options = { requreAtLeastOne: false, allowEmptyStrings: false },
) => {
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
    if (json[key] || (options.allowEmptyStrings && json[key] === '')) {
      params[key] = json[key];
    }
  });

  if (options.requreAtLeastOne && Object.keys(params).length === 0) {
    throw new HttpError(400, `No search parameters were provided, expected one of ${parameterNames}`);
  }

  return params;
};

const wait = (ms: number) => {
  return new Promise(resolve => {
    console.log(`waiting ${ms} ms...`);
    setTimeout(resolve, ms);
  });
};

export const poll = async (fn: any, fnCondition: any, ms = 1000, maxAttempts = 10) => {
  await wait(ms);
  let result = await fn();
  let attempt = 1;
  while (attempt < maxAttempts && fnCondition(result)) {
    // eslint-disable-next-line no-await-in-loop
    result = await fn();
    attempt += 1;
  }
  return result;
};

export const processList = (list: any[], fn: any, args: any) => {
  const promises: Promise<any>[] = [];
  list.forEach(item => {
    promises.push(
      args
        ? fn.call(undefined, item, ...args).catch((e: Error) => {
            console.log('Error processing item: ', e);
          })
        : fn.call(undefined, item).catch((e: Error) => {
            console.log('Error processing item: ', e);
          }),
    );
  });

  return promises;
};

export { Table, TableIndex, Joi } from './db';
export { AWS } from './aws';
export { GetSecret, SetSecret } from './secrets';
export { HttpError } from './errors';
export { SERVICE_NAME, STAGE } from './constants';
