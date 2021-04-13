import { APIGatewayProxyWithLambdaAuthorizerEvent } from 'aws-lambda';
import { HttpError } from 'errors';

export interface AuthContext {
  id: string;
  aud: string;
}

export type AuthorizedEvent = APIGatewayProxyWithLambdaAuthorizerEvent<AuthContext>;

export const GetIdentity = (event: AuthorizedEvent): string => {
  const { requestContext } = event;
  if (!requestContext) {
    throw new HttpError(500, 'Missing request context in event');
  }

  const { authorizer } = requestContext;
  if (!authorizer) {
    throw new HttpError(500, 'Missing authorizer in request context');
  }

  const { id, aud, principalId } = authorizer;

  if (!principalId) {
    throw new HttpError(500, 'Missing principalId in authorizer response');
  }

  if (id && aud === principalId) {
    console.log('Authorized identity:', id);
    return id;
  }

  if (!principalId.startsWith('offlineContext_authorizer')) {
    throw new HttpError(401, 'Unauthorized', {
      message: 'ID is missing from authorization and/or audience/principal mismatch',
    });
  }

  console.warn('Process is running in serverless-offline, re-verifying using Authorization header');

  const { headers } = event;
  if (!headers || Object.keys(headers).length === 0) {
    throw new HttpError(400, 'Missing headers');
  }

  const { Authorization: authorization } = headers;
  if (!authorization) {
    throw new HttpError(401, 'Unauthorized', { message: 'Authorization header is missing' });
  }

  throw new Error('Handling JWT tokens remotely is not yet implemented');
};
