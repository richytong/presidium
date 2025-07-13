require('rubico/global')
const ECRClient = require('aws-sdk/clients/ecr')
require('aws-sdk/lib/maintenance_mode_message').suppress = true

/**
 * @name ECR
 *
 * @docs
 * ```coffeescript [specscript]
 * new ECR(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> ecr ECR
 * ```
 */
class ECR {
  constructor(options) {
    this.client = new ECRClient({
      ...pick(options, [
        'accessKeyId',
        'secretAccessKey',
        'endpoint',
      ]),
      region: options.region ?? 'default-region',
      apiVersion: '2015-09-21',
    })
  }

  /**
   * @name createRepository
   *
   * @docs
   * ```coffeescript [specscript]
   * ecr.createRepository(repositoryName string, options {
   *   registryId: string,
   *   tags: Array<{
   *     Key: string,
   *     Value: string
   *   }>,
   *   imageTagMutability: 'MUTABLE'|'IMMUTABLE',
   *   imageScanningConfiguration: {
   *     scanOnPush: boolean
   *   },
   *   encryptionConfiguration: {
   *     encryptionType: 'AES256'|'KMS',
   *     kmsKey: string
   *   }
   * }) -> response Promise<{
   *   repository: {
   *     repositoryArn: string,
   *     registryId: string,
   *     repositoryName: string,
   *     repositoryUri: string,
   *     createdAt: Date,
   *     imageTagMutability: 'MUTABLE'|'IMMUTABLE',
   *     imageScanningConfiguration: {
   *       scanOnPush: boolean
   *     },
   *     encryptionConfiguration: {
   *       encryptionType: 'AES256'|'KMS',
   *       kmsKey: string
   *     }
   *   }
   * }>
   * ```
   */
  createRepository(repositoryName, options = {}) {
    const params = {
      repositoryName,
      ...options
    }
    return this.client.createRepository(params).promise()
  }

  /**
   * @name deleteRepository
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteRepository(repositoryName string, options {
   *   force: boolean
   * }) -> response Promise<{
   *   registryId: string,
   *   repository: {
   *     repositoryArn: string,
   *     registryId: string,
   *     repositoryName: string,
   *     repositoryUri: string,
   *     createdAt: Date,
   *     imageTagMutability: 'MUTABLE'|'IMMUTABLE',
   *   }
   * }>
   * ```
   */
  deleteRepository(repositoryName, options = {}) {
    const params = {
      repositoryName,
      ...options
    }
    return this.client.deleteRepository(params).promise()
  }

  /**
   * @name getAuthorizationToken
   *
   * @docs
   * ```coffeescript [specscript]
   * ecr.getAuthorizationToken() -> authToken Promise<string>
   * ```
   */
  getAuthorizationToken() {
    return this.client.getAuthorizationToken()
      .promise().then(get('authorizationData[0].authorizationToken'))
  }
}

module.exports = ECR
