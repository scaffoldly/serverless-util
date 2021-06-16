import { CleansedObject } from './interfaces';

export const cleanseObject = (obj: unknown): CleansedObject => {
  if (obj == null) {
    return {};
  }

  const parsed = JSON.parse(JSON.stringify(obj));
  const cleansed = Object.entries(parsed).reduce((acc, [key, value]) => {
    if (typeof value === 'string' || value instanceof String) {
      acc[key] = value as string;
    }

    if (typeof value === 'number' || value instanceof Number) {
      acc[key] = value as number;
    }

    if (typeof value === 'boolean' || value instanceof Boolean) {
      acc[key] = value as boolean;
    }

    return acc;
  }, {} as CleansedObject);

  return cleansed;
};
