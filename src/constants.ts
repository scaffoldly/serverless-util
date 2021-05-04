const { SERVICE_NAME, STAGE, ALLOWED_ORIGINS, ALLOWED_HEADERS } = process.env;

const serviceName = SERVICE_NAME || 'unknown-service';
const stage = STAGE || 'local';
const allowedOrigins = ALLOWED_ORIGINS || null;
const allowedHeaders =
  ALLOWED_HEADERS || 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent';

export {
  serviceName as SERVICE_NAME,
  stage as STAGE,
  allowedOrigins as ALLOWED_ORIGINS,
  allowedHeaders as ALLOWED_HEADERS,
};
