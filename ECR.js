require('rubico/global')
const crypto = require('crypto')
const HTTP = require('./HTTP')
const AmzDate = require('./internal/AmzDate')
const AwsAuthorization = require('./internal/AwsAuthorization')
const AwsError = require('./internal/AwsError')
const userAgent = require('./userAgent')
const Readable = require('./Readable')

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
    this.accessKeyId = options.accessKeyId ?? ''
    this.secretAccessKey = options.secretAccessKey ?? ''
    this.region = options.region ?? ''
    this.apiVersion = '2015-09-21'

    this.endpoint = `ecr.${this.region}.amazonaws.com`
    this.protocol = 'https'

    this.http = new HTTP(`${this.protocol}://${this.endpoint}`)
  }

  /**
   * @name _awsRequest
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * _awsRequest(
   *   method string,
   *   url string,
   *   action string,
   *   payload string
   * ) -> response Promise<http.ServerResponse>
   * ```
   */
  _awsRequest(method, url, action, payload) {
    const amzDate = AmzDate()
    const amzTarget = `AmazonEC2ContainerRegistry_V${this.apiVersion.replace(/-/g, '')}.${action}`

    const headers = {
      'Host': this.endpoint,
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
      'User-Agent': userAgent,
      'Content-Type': 'application/x-amz-json-1.1',
      'Authorization': 'AUTHPARAMS',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': amzTarget
    }

    const amzHeaders = {}
    for (const key in headers) {
      if (key.toLowerCase().startsWith('x-amz')) {
        amzHeaders[key] = headers[key]
      }
    }

    headers['Authorization'] = AwsAuthorization({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      method,
      endpoint: this.endpoint,
      protocol: this.protocol,
      canonicalUri: url,
      serviceName: 'ecr',
      payloadHash:
        crypto.createHash('sha256').update(payload, 'utf8').digest('hex'),
      expires: 300,
      queryParams: new URLSearchParams(),
      headers: {
        'Host': this.endpoint,
        ...amzHeaders
      }
    })

    return this.http[method](url, { headers, body: payload })
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
  async createRepository(repositoryName, options = {}) {
    const payload = JSON.stringify({
      repositoryName,
      ...options
    })
    const response = await this._awsRequest('POST', '/', 'CreateRepository', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
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
  async deleteRepository(repositoryName, options = {}) {
    const payload = JSON.stringify({
      repositoryName,
      ...options
    })
    const response = await this._awsRequest('POST', '/', 'DeleteRepository', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name getAuthorizationToken
   *
   * @docs
   * ```coffeescript [specscript]
   * ecr.getAuthorizationToken() -> authToken Promise<string>
   * ```
   */
  async getAuthorizationToken() {
    const response = await this._awsRequest('POST', '/', 'GetAuthorizationToken', '{}')

    if (response.ok) {
      const data = await Readable.JSON(response)
      const authToken = data.authorizationData[0].authorizationToken
      return authToken
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }
}

module.exports = ECR
