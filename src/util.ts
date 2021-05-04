import { ALLOWED_ORIGINS, ALLOWED_HEADERS } from './constants';

export const createHeaders = (event: any, headers = {} as { [key: string]: string }) => {
  const headerKeys = Object.keys(headers);

  headers['Access-Control-Expose-Headers'] = headers['Access-Control-Expose-Headers']
    ? headers['Access-Control-Expose-Headers']
    : headerKeys.join(',');

  headers['Access-Control-Allow-Headers'] = headers['Access-Control-Allow-Headers']
    ? headers['Access-Control-Allow-Headers']
    : [...headerKeys, ...ALLOWED_HEADERS.split(',')].join(',');

  headers['Access-Control-Allow-Credentials'] = headers['Access-Control-Allow-Credentials']
    ? headers['Access-Control-Allow-Credentials']
    : 'true';

  if (event && event.httpMethod) {
    headers['Access-Control-Allow-Methods'] = headers['Access-Control-Allow-Methods']
      ? headers['Access-Control-Allow-Methods']
      : event.httpMethod;
  }

  if (event && event.headers && !headers['Access-Control-Allow-Origin']) {
    const { origin } = event.headers;

    if (!ALLOWED_ORIGINS && !origin) {
      // No restriction on allowed origins, and orgin absent (e.g. mobile / backend )
      headers['Access-Control-Allow-Origin'] = '*';
    } else if (!ALLOWED_ORIGINS && origin) {
      // No restriction on allowed origins, and orgin present (e.g. browser)
      headers['Access-Control-Allow-Origin'] = origin;
    } else if (ALLOWED_ORIGINS && origin) {
      // Restriction on allowed origins, and orgin present (e.g. browser)
      const found = ALLOWED_ORIGINS.split(',').find((allowed) => allowed === origin);
      if (found) {
        headers['Access-Control-Allow-Origin'] = origin;
      }
    }
  }

  return headers;
};
