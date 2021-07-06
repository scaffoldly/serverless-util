import { v4 as uuid } from 'uuid';

const { SERVICE_NAME, STAGE } = process.env;

const serviceName = SERVICE_NAME || 'unknown-service';
const stage = STAGE || 'local';

export { serviceName as SERVICE_NAME, stage as STAGE };

export const PROCESS_UUID = uuid();
