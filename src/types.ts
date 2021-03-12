export class HandleSuccessOptions {
  statusCode? = 200;
  headers? = {};
}

export class HandleErrorOptions extends HandleSuccessOptions {
  context?: { [key: string]: any } = {};
}

export class OptionalParametersOptions {
  requreAtLeastOne? = false;
  allowEmptyStrings? = false;
}

export type AuthorizationType = 'apikey' | 'jwt';

export class ExtractAuthorizationOptions {
  throwError? = true;
  requiredAuthorizations: AuthorizationType[] = [];
}

export interface ExtractedAuthorization {
  token: string;
  context: { [key: string]: any };
}

export type ExtractedAuthorizations = { [key in AuthorizationType]?: ExtractedAuthorization };
