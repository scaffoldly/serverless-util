import { AWS } from './exports';
import { SERVICE_NAME, STAGE } from './constants';

const secretsmanager: AWS.SecretsManager = new AWS.SecretsManager();

const cache: any = {};

const GetSecretFromEnv = (key: string) => {
  console.log(`Checking local env for ${key}`);
  if (process.env[key]) {
    console.debug(`Found ${key} in local env!`);
    return process.env[`${key}`];
  }

  return null;
};

const GetSecretFromCache = (key: string, serviceName: string, stage: string) => {
  if (!cache[stage]) {
    return null;
  }

  if (!cache[stage][serviceName]) {
    return null;
  }

  console.log(`Fetching secret from cache: key=${key}, serviceName=${serviceName}, stage=${stage}`);

  if (key) {
    return cache[stage][serviceName][key];
  }

  return cache[stage][serviceName];
};

export const GetSecret = async (key: string, serviceName = SERVICE_NAME, stage = STAGE) => {
  const cached = GetSecretFromCache(key, serviceName, stage);
  if (cached) {
    return cached;
  }

  if (stage === 'local') {
    return GetSecretFromEnv(key);
  }

  try {
    const secretResponse = await secretsmanager
      .getSecretValue({
        SecretId: `lambda/${stage}/${serviceName}`,
      })
      .promise();

    if (!cache[stage]) {
      cache[stage] = {};
    }

    const parsed = JSON.parse(secretResponse.SecretString!);
    if (!parsed[key]) {
      console.warn(`Key not in secrets manager, skipping cache: key=${key} serviceName=${serviceName} stage=${stage}`);
      return null;
    }

    cache[stage][serviceName] = parsed;
    console.log(`Added secrets to cache: serviceName=${serviceName} stage=${stage}`);

    return GetSecretFromCache(key, serviceName, stage);
  } catch (e) {
    console.error(`Error fetching secret: key=${key} serviceName=${serviceName} stage=${stage}`, e);
    throw new Error(`Error fetching secret: ${e.message}`);
  }
};

export const SetSecret = async (key: string, value: string, base64Encode = false) => {
  const _value = base64Encode ? Buffer.from(value, 'utf8').toString('base64') : value;

  if (STAGE === 'local') {
    if (!cache[STAGE]) {
      cache[STAGE] = {};
    }

    if (!cache[STAGE][SERVICE_NAME]) {
      cache[STAGE][SERVICE_NAME] = {};
    }

    cache[STAGE][SERVICE_NAME][key] = _value;

    console.log(`Saved secret to cache: key=${key} serviceName=${SERVICE_NAME} stage=${STAGE}`);

    return _value;
  }

  try {
    const secretResponse = await secretsmanager
      .getSecretValue({
        SecretId: `lambda/${STAGE}/${SERVICE_NAME}`,
      })
      .promise();

    let secretString = secretResponse.SecretString;
    if (!secretString) {
      console.warn('No secrets set in Secrets Manager, generating an empty object');
      secretString = '{}';
    }

    const secrets = JSON.parse(secretString);

    secrets[key] = _value;

    await secretsmanager
      .putSecretValue({ SecretId: `lambda/${STAGE}/${SERVICE_NAME}`, SecretString: JSON.stringify(secrets) })
      .promise();

    console.log(`Added secret to Secrets Manager: key=${key} serviceName=${SERVICE_NAME} stage=${STAGE}`);

    const ret = await GetSecret(key, SERVICE_NAME, STAGE);
    return ret;
  } catch (e) {
    console.error(`Error setting secret: key=${key} serviceName=${SERVICE_NAME} stage=${STAGE}`, e);
    throw new Error(`Error fetching secret: ${e.message}`);
  }
};
