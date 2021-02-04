import { createHeaders } from './util';

const ALLOWED_STATUS_CODES = [400, 401, 403, 404, 422, 500, 502, 504];

export class HttpError extends Error {
  statusCode: number;
  context: { [key: string]: any };

  constructor(statusCode: number, message: string, context = {} as { [key: string]: any }) {
    let actualStatusCode = statusCode;
    let actualName = `HTTP Error ${statusCode}`;

    // Serverless only supports the above status codes, make sure the status code is in the list, if not set it to 500
    if (ALLOWED_STATUS_CODES.indexOf(statusCode) === -1) {
      actualStatusCode = 500;
      actualName = `${actualName} [Original Status Code: ${statusCode}]`;
    }
    super(message);

    this.name = actualName;
    this.statusCode = actualStatusCode;
    this.context = context || {};
  }

  response(event: any, headers = {}) {
    const response = {
      statusCode: this.statusCode,
      headers: createHeaders(event, headers),
      body: JSON.stringify({ error: this.name, message: this.message, context: this.createContext() }),
    };

    console.error('Error response:', JSON.stringify(response, null, 2));

    return response;
  }

  createContext(): { [key: string]: any } {
    return Object.entries(this.context).reduce((acc, [key, value]) => {
      if (value instanceof Error) {
        // Unwrap the error since it doesnt serialize consistently
        acc[key] = {
          name: value.name,
          message: value.message,
          type: typeof value,
        };
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as { [key: string]: any });
  }
}
