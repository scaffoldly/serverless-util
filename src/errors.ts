import { createHeaders } from './util';

const ALLOWED_STATUS_CODES = [400, 401, 403, 404, 422, 500, 502, 504];

export class HttpError extends Error {
  statusCode: number;
  obj: any;
  constructor(statusCode: number, message: string, obj: any = null) {
    let actualMessage = message;
    let actualStatusCode = statusCode;

    // Serverless only supports the above status codes, make sure the status code is in the list, if not set it to 500
    if (ALLOWED_STATUS_CODES.indexOf(statusCode) === -1) {
      actualMessage = `${actualMessage} (Original Status Code was: ${statusCode})`;
      actualStatusCode = 500;
    }
    super(actualMessage);

    this.statusCode = actualStatusCode;
    this.obj = obj;

    if (!this.stack) {
      this.stack = new Error().stack;
    }
  }

  response(event: any) {
    return {
      statusCode: this.statusCode,
      headers: createHeaders(event),
      body: JSON.stringify({ message: this.message }),
    };
  }
}
