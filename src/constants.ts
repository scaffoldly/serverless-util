import { v4 as uuid } from 'uuid';

const { SERVICE_NAME, STAGE, API_GATEWAY_DOMAIN, STAGE_DOMAIN } = process.env;

const serviceName = SERVICE_NAME || 'unknown-service';
const stage = STAGE || 'local';
const apiGatewayDomain = API_GATEWAY_DOMAIN || 'localhost';
const stageDomain = STAGE_DOMAIN || 'localhost';

export {
  serviceName as SERVICE_NAME,
  stage as STAGE,
  apiGatewayDomain as API_GATEWAY_DOMAIN,
  stageDomain as STAGE_DOMAIN,
};

export const MAPPED_EVENT_HEADER = 'x-mapped-event';
export const MAPPED_EVENT_DYNAMODB_STREAM = 'dynamodb-stream-event';
export const MAPPED_EVENT_SNS = 'sns-event';

export const PROCESS_UUID_HEADER = 'x-process-uuid';
export const PROCESS_UUID = uuid();
