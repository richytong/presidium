require('rubico/global')
const AWSECR = require('aws-sdk/clients/ecr')

/**
 * @name ECR
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ECR(options {
 *   ...({
 *     accessKeyId: string,
 *     secretAccessKey: string,
 *     region: string,
 *   })|({
 *     endpoint: string,
 *     region: string,
 *   })
 * }) -> ECR
 * ```
 */
const ECR = function (options) {
  this.awsEcr = new AWSECR({
    apiVersion: '2015-09-21',
    ...pick([
      'accessKeyId',
      'secretAccessKey',
      'region',
      'endpoint',
    ])(options),
  })
  return this
}

/**
 * @name ECR.prototype.getAuthorizationToken
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ECR(...).getAuthorizationToken() -> Promise<{
 * }>
 * ```
 */
ECR.prototype.getAuthorizationToken = function getAuthorizationToken() {
  return this.awsEcr.getAuthorizationToken()
    .promise().then(get('authorizationData[0]'))
}

module.exports = ECR
