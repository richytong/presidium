const AWSKinesis = require('aws-sdk/clients/kinesis')

/**
 * @name Kinesis
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Kinesis(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> Kinesis
 * ```
 *
 * @description
 * Kinesis base. https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html
 */
const Kinesis = function (options) {
  if (this == null || this.constructor != Kinesis) {
    return new Kinesis(options)
  }
  this.client = new AWSKinesis({
    apiVersion: '2013-12-02',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    region: 'x-x-x',
    ...options,
  })
  return this
}

module.exports = Kinesis
