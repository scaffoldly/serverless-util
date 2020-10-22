import { HttpError } from './errors';
import { AWS, _AWS } from './aws';
import { SERVICE_NAME, STAGE } from './constants';

let secretsmanager: AWS.SecretsManager;

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

  if (!secretsmanager) {
    const aws = stage === 'local' ? _AWS : AWS;
    secretsmanager = new aws.SecretsManager();
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
    cache[stage][serviceName] = JSON.parse(secretResponse.SecretString!);
    console.log(`Added secrets to cache: serviceName=${serviceName} stage=${stage}`);

    return GetSecretFromCache(key, serviceName, stage);
  } catch (e) {
    console.error(`Error fetching secret: key=${key} serviceName=${serviceName} stage=${stage}`, e);
    throw new Error(`Error fetching secret: ${e.message}`);
  }
};
