/* eslint-disable @typescript-eslint/dot-notation */
import { ValidateError } from 'tsoa';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import morganBody from 'morgan-body';
import { ErrorResponse, ErrorResponseTracking } from './interfaces';
import { XRAY_ENV_TRACE_ID } from './exports';
import { HttpError } from './errors';
import { MAPPED_EVENT_HEADER } from './constants';

type StaticOrigin = boolean | string | RegExp | (string | RegExp)[];
type CustomOrigin = (
  requestOrigin: string | undefined,
  callback: (err: Error | null, origin?: StaticOrigin) => void,
) => void;

export interface CorsOptions {
  headers?: string[];
  withCredentials?: boolean;
  maxAge?: number;
  origin?: StaticOrigin | CustomOrigin;
}

export const createApp = ({ logHeaders = false } = {}): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  morganBody(app, {
    noColors: true,
    immediateReqLog: true,
    prettify: false,
    logAllReqHeader: logHeaders,
    stream: {
      write(data: any) {
        console.log(data);
        return false;
      },
    },
  });

  return app;
};

export function corsHandler(options: CorsOptions = {}): (
  req: cors.CorsRequest,
  res: {
    statusCode?: number;
    setHeader(key: string, value: string): any;
    end(): any;
  },
  next: (err?: any) => any,
) => void {
  return cors({
    origin: options.origin ? options.origin : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    maxAge: options.maxAge ? options.maxAge : 7200,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
      'X-Retry',
      ...(options.headers && options.headers.length ? options.headers : []),
    ],
    credentials: options.withCredentials,
    exposedHeaders: ['X-Amzn-Trace-Id', ...(options.headers && options.headers.length ? options.headers : [])],
    optionsSuccessStatus: 200,
    preflightContinue: true,
  });
}

export function errorHandler(version: string) {
  return (err: Error | any, req: Request, res: Response, next: NextFunction): Response | void => {
    const traceId = process.env[XRAY_ENV_TRACE_ID] || 'Unknown-Trace-Id';

    console.warn(`[Error] [${traceId}] [${err.name || Object.getPrototypeOf(err)}] Message: ${err.message}`, err);

    const tracking: ErrorResponseTracking = {
      method: req.method,
      path: req.path,
      version,
    };

    let httpError: HttpError;

    if (err instanceof HttpError) {
      httpError = err;
    } else if (err instanceof ValidateError || err.name === 'ValidateError') {
      httpError = new HttpError(err.status, 'Validation Failed', { fields: err.fields });
    } else if (err.statusCode) {
      httpError = new HttpError(err.statusCode, err.message || err.name, err);
    } else {
      httpError = new HttpError(500, err.message || 'Internal Server Error', err);
    }

    const errorResponse: ErrorResponse = {
      message: httpError.message,
      traceId,
      tracking,
      context: httpError.context,
    };

    if (req.header(MAPPED_EVENT_HEADER)) {
      console.log(
        'Error from mapped event (i.e. not an HTTP API invocation). Re-throwing error to trigger retries',
        errorResponse,
      );
      throw err;
    }

    res.status(httpError.statusCode).json(errorResponse);

    next();
  };
}

export const registerDocs = (app: Express, swaggerJson: { [key: string]: any }): void => {
  app.get('/openapi.json', (_req: express.Request, res: express.Response) => {
    res.send(JSON.stringify(swaggerJson));
  });
};

export const registerVersion = (app: Express, version: string): void => {
  app.get('/version', (_req: express.Request, res: express.Response) => {
    res.send(JSON.stringify({ version }));
  });
};
