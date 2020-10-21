import { HttpError } from './errors';
import { AWS, _AWS } from './aws';

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

const GetSecretFromCache = (name: string, key: string, stage = 'local') => {
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

export const GetSecret = async (name: string, key: string, stage = 'local') => {
  const cached = GetSecretFromCache(name, key, stage);
  if (cached) {
    return cached;
  }

  if (!secretsmanager) {
    const aws = stage === 'local' ? _AWS : AWS;
    secretsmanager = new aws.SecretsManager();
  }

  try {
    const secretResponse = await secretsmanager
      .getSecretValue({
        SecretId: `lambda/${stage}/${name}`,
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

    const envVal = GetSecretFromEnv(key);
    if (envVal) {
      return envVal;
    }

    throw new HttpError(500, `Error fetching secret: ${e.message}`);
  }
};
