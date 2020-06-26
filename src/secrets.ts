import { SecretsManager } from 'aws-sdk';
import { HttpError } from './errors';

const secretsmanager = new SecretsManager();

const cache: any = {};

const GetSecretFromEnv = (name: string, key: string | null, stage = 'local') => {
  const envVar = key ? `${stage}.${name}.${key}` : `${stage}.${name}`;
  console.log(`Checking local env for ${envVar}`);
  if (process.env[envVar]) {
    console.debug(`Found ${envVar} in local env!`);
    return process.env[`${envVar}`];
  }

  return null;
};

const GetSecretFromCache = (name: string, key: string | null, stage = 'local') => {
  if (!cache[stage]) {
    return null;
  }

  if (!cache[stage][name]) {
    return null;
  }

  console.log(`Fetching secret from cache: name=${name} stage=${stage} key=${key}`);

  if (key) {
    return cache[stage][name][key];
  }

  return cache[stage][name];
};

export const GetSecret = async (name: string, key: string | null, stage = 'local') => {
  const cached = GetSecretFromCache(name, key, stage);
  if (cached) {
    return cached;
  }

  try {
    const secretResponse = await secretsmanager
      .getSecretValue({
        SecretId: `lambda/${stage}/${name}-generic-secrets`,
      })
      .promise();

    if (!cache[stage]) {
      cache[stage] = {};
    }
    cache[stage][name] = JSON.parse(secretResponse.SecretString!);
    console.log(`Added secrets to cache: name=${name} stage=${stage}`);

    return GetSecretFromCache(name, key, stage);
  } catch (e) {
    console.error(`Error fetching secret: name=${name} stage=${stage} key=${key}: ${e.message}`);

    const envVal = GetSecretFromEnv(name, key, stage);
    if (envVal) {
      return envVal;
    }

    throw new HttpError(500, `Error fetching secret: ${e.message}`);
  }
};
