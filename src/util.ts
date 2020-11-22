import { ALLOWED_ORIGINS } from './constants';

export const createHeaders = (event: any) => {
  const headers: { [key: string]: string } = {};

  headers['Access-Control-Allow-Headers'] =
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent';

  if (event && event.httpMethod) {
    headers['Access-Control-Allow-Methods'] = event.httpMethod;
  }

  if (!ALLOWED_ORIGINS) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  if (ALLOWED_ORIGINS && event && event.headers.origin) {
    const origin = ALLOWED_ORIGINS.split(',').find(allowedOrigin => allowedOrigin === event.headers.origin);
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
  }

  return headers;
};
