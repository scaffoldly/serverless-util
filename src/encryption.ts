import { STAGE } from './constants';
import { KMS } from './exports';

export type EncryptedValue = {
  keyId: string;
  value: string;
};

export const encryptValue = async (value: string, keyId?: string): Promise<EncryptedValue> => {
  const kms = await KMS();

  const KeyId = keyId || `alias/${STAGE}`;

  const encryptResult = await kms.encrypt({ KeyId, Plaintext: Buffer.from(value, 'utf-8') }).promise();

  if (!encryptResult.KeyId) {
    throw new Error('Missing key id in encryption response');
  }

  if (!encryptResult.CiphertextBlob) {
    throw new Error('Missing cyphertext blob in encryption response');
  }

  return {
    keyId: KeyId,
    value: encryptResult.CiphertextBlob.toString('base64'),
  };
};

export const decryptValue = async (value: EncryptedValue): Promise<string> => {
  const kms = await KMS();

  const decryptResult = await kms
    .decrypt({
      KeyId: value.keyId,
      CiphertextBlob: Buffer.from(value.value, 'base64'),
    })
    .promise();

  if (!decryptResult.Plaintext) {
    throw new Error('Missing plaintext result');
  }

  return decryptResult.Plaintext.toString('utf-8');
};
