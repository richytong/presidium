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
 * }) -> ecr ECR
 * ```
 * Presidium ECR client for [Amazon ECR](https://aws.amazon.com/ecr/).
 *
 * Arguments:
 *   * `options`
 *     * `accessKeyId` - long term credential (ID) of an [IAM](https://aws.amazon.com/iam/) user.
 *     * `secretAccessKey` - long term credential (secret) of an [IAM](https://aws.amazon.com/iam/) user.
 *     * `region` - geographic location of data center cluster, e.g. `us-east-1` or `us-west-2`. [Full list of AWS regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html#available-regions)
 *
 * * Return:
 *   * `ecr` - an instance of the Presidium ECR client.
 *
 * ```javascript
 * const awsCreds = AwsCredentials('my-profile')
 * awsCreds.region = 'us-east-1'
 *
 * const ecr = new ECR({ ...awsCreds })
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
   * module AWSECRDocs 'https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Types.html'
   *
   * createRepository(repositoryName string, options {
   *   tags: Array<{ Key: string, Value: string }>,
   *   imageTagMutability: 'MUTABLE'|'IMMUTABLE', # defaults to 'MUTABLE'
   *   encryptionConfiguration: AWSECRDocs.EncryptionConfiguration,
   * }) -> data Promise<{
   *   repository: AWSECRDocs.Repository,
   * }>
   * ```
   *
   * Creates an ECR repository.
   *
   * Arguments:
   *   * `repositoryName` - the name of the ECR repository to create.
   *   * `options`
   *     * `tags` - user-defined metadata that will be applied to the ECR repository.
   *     * `imageTagMutability` - the tag mutability setting for the ECR repository.
   *     * `encryptionConfiguration` - [`AWSECRDocs.EncryptionConfiguration`](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_EncryptionConfiguration.html)  - the encryption configuration for the ECR repository.
   *
   * Return:
   *   * `data`
   *     * `repository` - [`AWSECRDocs.Repository`](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html) - the ECR repository data.
   *
   * `imageTagMutability` values:
   *   * `MUTABLE` - image tags may be overwritten.
   *   * `IMMUTABLE` - image tags cannot be overwritten.
   *
   * ```javascript
   * const awsCreds = AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const ecr = new ECR({ ...awsCreds })
   *
   * await ecr.createRepository('my-repository')
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
   * module AWSECRDocs 'https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Types.html'
   *
   * deleteRepository(repositoryName string, options {
   *   force: boolean
   * }) -> data Promise<{
   *   repository: AWSECRDocs.Repository,
   * }>
   * ```
   *
   * Deletes an ECR repository.
   *
   * Arguments:
   *   * `repositoryName` - the name of the ECR repository to delete.
   *   * `options`
   *     * `force` - whether to force delete the contents of the ECR repository.
   *
   * Return:
   *   * `data`
   *     * `repository` - [`AWSECRDocs.Repository`](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html) - the deleted ECR repository data.
   *
   * ```javascript
   * const awsCreds = AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const ecr = new ECR({ ...awsCreds })
   *
   * await ecr.deleteRepository('my-repository')
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
   * getAuthorizationToken() -> authToken Promise<string>
   * ```
   *
   * Gets an authorization token from Amazon ECR.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `authToken` - the ECR authorization token
   *
   * ```javascript
   * const awsCreds = AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const ecr = new ECR({ ...awsCreds })
   *
   * const authToken = await ecr.getAuthorizationToken()
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
