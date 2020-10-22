const { SERVICE_NAME, STAGE } = process.env;

const serviceName = SERVICE_NAME || 'unknown-service';
const stage = STAGE || 'local';

export { serviceName as SERVICE_NAME, stage as STAGE };
