import { v4 as uuid } from 'uuid';

const { SERVICE_NAME, STAGE, API_GATEWAY_DOMAIN, STAGE_DOMAIN, SERVICE_SLUG } = process.env;

const apiGatewayDomain = API_GATEWAY_DOMAIN || 'localhost';
const stageDomain = STAGE_DOMAIN || 'localhost';
const serviceName = SERVICE_NAME || 'unknown-service-name';
const serviceSlug = SERVICE_SLUG || '';
const stage = STAGE || 'local';

export {
  apiGatewayDomain as API_GATEWAY_DOMAIN,
  stageDomain as STAGE_DOMAIN,
  serviceName as SERVICE_NAME,
  serviceSlug as SERVICE_SLUG,
  stage as STAGE,
};

export const MAPPED_EVENT_HEADER = 'x-mapped-event';
export const MAPPED_EVENT_DYNAMODB_STREAM = 'dynamodb-stream-event';
export const MAPPED_EVENT_SNS = 'sns-event';

export const PROCESS_UUID_HEADER = 'x-process-uuid';
export const PROCESS_UUID = uuid();
