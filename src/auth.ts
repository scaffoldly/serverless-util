import { APIGatewayProxyWithLambdaAuthorizerEvent, Context } from 'aws-lambda';
import { HttpError } from './errors';
import { JWT } from 'jose';
import axios from 'axios';

export interface AuthContext {
  id: string;
  aud: string;
  verifyUrl: string;
}

export type AuthorizedEvent = APIGatewayProxyWithLambdaAuthorizerEvent<AuthContext>;

export const GetIdentity = async (event: AuthorizedEvent, context: Context): Promise<string> => {
  const { invokedFunctionArn: methodArn } = context;
  if (!methodArn) {
    throw new HttpError(500, 'Missing invokedFunctionArn in context');
  }

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

  const jwt = authorization.split(' ')[1];
  if (!jwt) {
    throw new HttpError(400, 'Invalid authorization header format');
  }

  const decoded = JWT.decode(jwt) as AuthContext;
  if (!decoded) {
    throw new HttpError(400, 'Unable to decode authorization header jwt');
  }

  const { verifyUrl } = decoded;

  if (!verifyUrl) {
    throw new HttpError(400, 'Missing verifyUrl in jwt payload');
  }

  const { data } = await axios.post(verifyUrl, { jwt, methodArn });
  if (!data) {
    throw new HttpError(500, `No data in verify response from ${verifyUrl}`);
  }

  const { id: remoteId } = data;
  if (!remoteId) {
    throw new HttpError(500, 'Unable to find id field in verification response', data);
  }

  console.log(`Remotely authorized identity (via ${verifyUrl}):`, remoteId);

  return remoteId;
};
