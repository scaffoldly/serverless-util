import * as AWSXRay from 'aws-xray-sdk-core';
import * as _AWS from 'aws-sdk';
import { SERVICE_NAME, STAGE, STAGE_DOMAIN } from '../constants';
import * as http from 'http';
import { boolean } from 'boolean';

export const { LOCALSTACK = 'false' } = process.env;

export const AWS = STAGE !== 'local' ? AWSXRay.captureAWS(_AWS) : _AWS;
export const XRAY_ENV_TRACE_ID = '_X_AMZN_TRACE_ID';

if (STAGE !== 'local') {
  try {
    // https://github.com/aws/aws-xray-sdk-node/issues/433
    AWSXRay.captureHTTPsGlobal(http, true);
  } catch (e: any) {
    console.warn('Unable to capture outbound HTTP requests for X-Ray', e.message);
  }
}

const instances: {
  [region: string]: { kms?: AWS.KMS; s3?: AWS.S3; ses?: AWS.SES; sns?: AWS.SNS; secretsManager?: AWS.SecretsManager };
} = {};

export const KMS = async (region: string = 'us-east-1'): Promise<AWS.KMS> => {
  if (!instances[region]) {
    instances[region] = {};
  }

  let { kms } = instances[region];

  if (kms) {
    return kms;
  }

  if (!boolean(LOCALSTACK)) {
    kms = new AWS.KMS({ region: region });
  } else {
    console.warn('Using Localstack KMS');
    kms = new AWS.KMS({ endpoint: 'http://localhost:4566', region });
  }

  instances[region].kms = kms;

  if (!boolean(LOCALSTACK)) {
    return kms;
  }

  const keyAlias = `alias/${STAGE}`;
  try {
    let key = await kms.describeKey({ KeyId: keyAlias }).promise();
    if (!key || !key.KeyMetadata) {
      throw new Error('Missing metadata while describing aws/lambda key');
    }
  } catch (e) {
    try {
      const key = await kms.createKey({ KeyUsage: 'ENCRYPT_DECRYPT', Description: keyAlias }).promise();
      if (!key || !key.KeyMetadata) {
        throw new Error('Missing metadata while creating aws/lambda key');
      }
      await kms.createAlias({ TargetKeyId: key.KeyMetadata.KeyId, AliasName: keyAlias }).promise();
    } catch (e: any) {
      console.warn('Error initializing KMS', e.message);
    }
  }

  return kms;
};

export const S3 = async (region: string = 'us-east-1'): Promise<AWS.S3> => {
  if (!instances[region]) {
    instances[region] = {};
  }

  let { s3 } = instances[region];

  if (s3) {
    return s3;
  }

  if (!boolean(LOCALSTACK)) {
    s3 = new AWS.S3({ region: region });
  } else {
    console.warn('Using Localstack S3');
    s3 = new AWS.S3({ endpoint: 'http://localhost:4566', region });
  }

  instances[region].s3 = s3;

  if (!boolean(LOCALSTACK)) {
    return s3;
  }

  return s3;
};

export const SES = async (region: string = 'us-east-1'): Promise<AWS.SES> => {
  if (!instances[region]) {
    instances[region] = {};
  }

  let { ses } = instances[region];

  if (ses) {
    return ses;
  }

  if (!boolean(LOCALSTACK)) {
    ses = new AWS.SES({ region: region });
  } else {
    ses = new AWS.SES({ endpoint: 'http://localhost:4566', region });
  }

  instances[region].ses = ses;

  if (!boolean(LOCALSTACK)) {
    return ses;
  }

  try {
    const domain = STAGE_DOMAIN;
    console.log(`Initializing SES with default domain`, domain);
    // This request is idempotent so we don't have to check for an existing domain identity
    await ses.verifyDomainIdentity({ Domain: domain }).promise();
  } catch (e: any) {
    console.warn('Error initializing SES', e.message);
  }

  return ses;
};

export const SNS = async (region: string = 'us-east-1'): Promise<AWS.SNS> => {
  if (!instances[region]) {
    instances[region] = {};
  }

  let { sns } = instances[region];

  if (sns) {
    return sns;
  }

  if (!boolean(LOCALSTACK)) {
    sns = new AWS.SNS({ region: region });
  } else {
    console.warn('Using Localstack SNS');
    sns = new AWS.SNS({ endpoint: 'http://localhost:4566', region });
  }

  instances[region].sns = sns;

  if (!boolean(LOCALSTACK)) {
    return sns;
  }

  instances[region].sns = new AWS.SNS({ endpoint: 'http://localhost:4566', region });

  return sns;
};

export const SecretsManager = async (
  serviceName = SERVICE_NAME,
  stage = STAGE,
  region: string = 'us-east-1',
): Promise<AWS.SecretsManager> => {
  if (!instances[region]) {
    instances[region] = {};
  }

  let { secretsManager } = instances[region];

  if (secretsManager) {
    return secretsManager;
  }

  if (!boolean(LOCALSTACK)) {
    secretsManager = new AWS.SecretsManager({ region: region });
  } else {
    console.warn('Using Localstack SecretsManager');
    secretsManager = new AWS.SecretsManager({ endpoint: 'http://localhost:4566', region });
  }

  instances[region].secretsManager = secretsManager;

  if (!boolean(LOCALSTACK)) {
    return secretsManager;
  }

  try {
    const secretName = `lambda/${stage}/${serviceName}`;
    console.log('Initializing SSM with default secret', secretName);
    await secretsManager.createSecret({ Name: secretName, SecretString: JSON.stringify({}) }).promise();
  } catch (e: any) {
    console.warn('Error initializing SSM', e.message);
  }

  return secretsManager;
};
