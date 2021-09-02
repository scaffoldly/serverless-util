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

export const KMS = (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.KMS({ region: region });
  }

  console.warn('Using Localstack');
  const kms = new AWS.KMS({ endpoint: 'http://localhost:4566', region });

  kms
    .describeKey({ KeyId: 'aws/lambda' })
    .promise()
    .then((key) => {
      if (key && key.KeyMetadata) {
        console.info('Using aws/lambda KMS key:', key.KeyMetadata.KeyId);
        return;
      }
      kms
        .createKey({ KeyUsage: 'ENCRYPT_DECRYPT' })
        .promise()
        .then((createdKey) => {
          if (createdKey && createdKey.KeyMetadata) {
            kms
              .createAlias({ TargetKeyId: createdKey.KeyMetadata?.KeyId, AliasName: 'aws/lambda' })
              .promise()
              .then(() => {
                console.info('Created aws/lamda KMS key');
              })
              .catch((e) => {
                throw e;
              });
            return;
          }
          throw new Error('Unable to create aws/lambda KMS key');
        })
        .catch((e) => {
          throw e;
        });
    })
    .catch((e) => {
      console.error('Unable to create aws/lambda key', e.message);
    });

  return kms;
};

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
