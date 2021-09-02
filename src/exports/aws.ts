import * as AWSXRay from 'aws-xray-sdk-core';
import * as _AWS from 'aws-sdk';
import { STAGE } from '../constants';
import * as http from 'http';
import { boolean } from 'boolean';

const { LOCALSTACK = 'false' } = process.env;

export const AWS = STAGE !== 'local' ? AWSXRay.captureAWS(_AWS) : _AWS;
export const XRAY_ENV_TRACE_ID = '_X_AMZN_TRACE_ID';

if (STAGE !== 'local') {
  AWSXRay.captureHTTPsGlobal(http, true);
}

export const S3 = (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.S3({ region: region });
  }

  console.warn('Using Localstack');
  return new AWS.S3({ endpoint: 'http://localhost:4566', region });
};

export const SES = (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.SES({ region: region });
  }

  console.warn('Using Localstack');
  return new AWS.SES({ endpoint: 'http://localhost:4566', region });
};

export const SNS = (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.SNS({ region: region });
  }

  console.warn('Using Localstack');
  return new AWS.SNS({ endpoint: 'http://localhost:4566', region });
};
