export const createHeaders = (event: any) => {
  const headers: { [key: string]: string } = {};

  if (event && event.httpMethod && event.headers.Host) {
    headers['Access-Control-Allow-Headers'] =
      'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent';
    headers['Access-Control-Allow-Methods'] = `OPTIONS,${event.httpMethod}`;
    headers['Access-Control-Allow-Origin'] = event.headers.Host;
  }
  return headers;
};
