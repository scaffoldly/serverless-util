import { v4 as uuid } from 'uuid';

const { SERVICE_NAME, STAGE } = process.env;

const serviceName = SERVICE_NAME || 'unknown-service';
const stage = STAGE || 'local';

export { serviceName as SERVICE_NAME, stage as STAGE };

export const MAPPED_EVENT_HEADER = 'x-mapped-event';
export const MAPPED_EVENT_DYNAMODB_STREAM = 'dynamodb-stream-event';

export const PROCESS_UUID_HEADER = 'x-process-uuid';
export const PROCESS_UUID = uuid();
