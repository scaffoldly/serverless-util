import { SNSEventRecord } from 'aws-lambda';

export type CanHandleSnsFn = (T: string, V: number) => boolean;

export type SnsHandler<E extends BaseEvent<T, V>, T extends string, V extends number, K = E> = {
  canHandle: CanHandleSnsFn;
  handle: (e: E) => Promise<E | K | null>;
};

export type BaseEvent<T extends string, V extends number> = {
  type: T;
  version: V;
};

export const handleSnsEventRecord = async <E extends BaseEvent<T, V>, T extends string, V extends number, K = E>(
  record: SNSEventRecord,
  handler: SnsHandler<E, T, V, K>,
): Promise<E | K | null> => {
  if (!record || !record.Sns || !record.Sns.Message) {
    throw new Error('Invalid record');
  }

  const message = JSON.parse(record.Sns.Message) as E;

  if (!handler.canHandle(message.type, message.version)) {
    return null;
  }

  return handler.handle(message);
};
