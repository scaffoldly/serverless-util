const ALLOWED_STATUS_CODES = [400, 401, 403, 404, 422, 429, 500, 502, 504];

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
}
