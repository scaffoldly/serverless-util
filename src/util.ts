import { ALLOWED_ORIGINS } from './constants';

export const createHeaders = (event: any) => {
  const headers: { [key: string]: string } = {};

  if (event && event.httpMethod && event.headers.origin) {
    headers['Access-Control-Allow-Headers'] =
      'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent';
    headers['Access-Control-Allow-Methods'] = `OPTIONS,${event.httpMethod}`;
    if (ALLOWED_ORIGINS) {
      const origin = ALLOWED_ORIGINS.split(',').find(allowedOrigin =>
        event.headers.origin.endsWith(`://${allowedOrigin}`),
      );
      if (origin) {
        headers['Access-Control-Allow-Origin'] = event.headers.origin;
      }
    } else {
      headers['Access-Control-Allow-Origin'] = '*';
    }
  }
  return headers;
};
