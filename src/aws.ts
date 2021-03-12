import * as AWSXRay from 'aws-xray-sdk-core';
import * as _AWS from 'aws-sdk';
const AWS = AWSXRay.captureAWS(_AWS);

export { AWS, _AWS, AWSXRay };
