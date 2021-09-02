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

export const KMS = async (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.KMS({ region: region });
  }

  console.warn('Using Localstack');
  const kms = new AWS.KMS({ endpoint: 'http://localhost:4566', region });

  try {
    const key = await kms.describeKey({ KeyId: 'aws/lambda' }).promise();
    if (!key || !key.KeyMetadata) {
      throw new Error('Missing metadata while describing aws/lambda key');
    }
  } catch (e) {
    console.log('Creating aws/lambda KMS key');
    try {
      const key = await kms.createKey({ KeyUsage: 'ENCRYPT_DECRYPT', Description: 'aws/lambda' }).promise();
      if (!key || !key.KeyMetadata || !key.KeyMetadata.Arn) {
        throw new Error('Missing metadata while creating aws/lambda key');
      }
      await kms.createAlias({ TargetKeyId: key.KeyMetadata.Arn, AliasName: 'aws/lambda' }).promise();
    } catch (e2) {
      console.warn('Unable to create aws/lambda KMS key', e2.message);
    }
  }

  return kms;
};

export const S3 = async (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.S3({ region: region });
  }

  console.warn('Using Localstack');
  return new AWS.S3({ endpoint: 'http://localhost:4566', region });
};

export const SES = async (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.SES({ region: region });
  }

  console.warn('Using Localstack');
  return new AWS.SES({ endpoint: 'http://localhost:4566', region });
};

export const SNS = async (region?: string) => {
  if (!boolean(LOCALSTACK)) {
    return new AWS.SNS({ region: region });
  }

  console.warn('Using Localstack');
  return new AWS.SNS({ endpoint: 'http://localhost:4566', region });
};
