const { SERVICE_NAME, STAGE, ALLOWED_ORIGINS } = process.env;

const serviceName = SERVICE_NAME || 'unknown-service';
const stage = STAGE || 'local';
const allowedOrigins = ALLOWED_ORIGINS || null;

export { serviceName as SERVICE_NAME, stage as STAGE, allowedOrigins as ALLOWED_ORIGINS };
