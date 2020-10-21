import AWSXRay = require('aws-xray-sdk-core');
import _AWS = require('aws-sdk');
const AWS = AWSXRay.captureAWS(_AWS);

export { AWS, _AWS };
