require('rubico/global')
const crypto = require('crypto')
const HTTP = require('./HTTP')
const AmzDate = require('./internal/AmzDate')
const AwsAuthorization = require('./internal/AwsAuthorization')
const AwsError = require('./internal/AwsError')
const userAgent = require('./userAgent')
const Readable = require('./Readable')
const handleAwsResponse = require('./internal/handleAwsResponse')
const retryableErrorNames = require('./internal/retryableErrorNames')

/**
 * @name SecretsManager
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }|{
 *   endpoint: string,
 *   region: string,
 * }) -> secretsManager Object
 * ```
 */
class SecretsManager {
  constructor(options) {
    this.accessKeyId = options.accessKeyId ?? ''
    this.secretAccessKey = options.secretAccessKey ?? ''
    this.region = options.region ?? ''
    this.apiVersion = '2017-10-17'

    this.endpoint = `secretsmanager.${this.region}.amazonaws.com`
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
    const amzTarget = `secretsmanager.${action}`

    const headers = {
      'Host': this.endpoint,
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
      'User-Agent': userAgent,
      'Content-Type': 'application/x-amz-json-1.1',
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
      serviceName: 'secretsmanager',
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
   * @name putSecret
   *
   * @synopsis
   * ```coffeescript [specscript]
   * putSecret(name string, secretString string) -> result Promise<{
   *   ARN: string,
   *   Name: string,
   *   VersionId: string,
   * }>
   * ```
   */
  async putSecret(name, secretString) {
    const createSecretPayload = JSON.stringify({
      ClientRequestToken: crypto.randomUUID(),
      Name: name,
      SecretString: secretString,
    })
    const createSecretResponse =
      await this._awsRequest('POST', '/', 'CreateSecret', createSecretPayload)

    if (createSecretResponse.ok) {
      const data = await Readable.JSON(createSecretResponse)
      return data
    }

    const createSecretAwsError = new AwsError(
      await Readable.Text(createSecretResponse),
      createSecretResponse.status
    )

    if (createSecretAwsError.name == 'ResourceExistsException') {
      // continue
    } else if (retryableErrorNames.includes(error.name)) {
      await sleep(1000)
      return putSecret.call(this, name, secretString)
    } else {
      throw createSecretAwsError
    }

    const secret = await this.getSecret(name)

    const updateSecretPayload = JSON.stringify({
      ClientRequestToken: crypto.randomUUID(),
      SecretId: secret.ARN,
      SecretString: secretString,
    })
    const updateSecretResponse =
      await this._awsRequest('POST', '/', 'UpdateSecret', updateSecretPayload)

    return handleAwsResponse.call(
      this,
      updateSecretResponse,
      this.putSecret,
      name,
      secretString
    )
  }

  /**
   * @name getSecret
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getSecret(name string) -> result Promise<{
   *   ARN: string,
   *   CreatedDate: Date,
   *   Name: string,
   *   SecretString: string,
   *   VersionId: string,
   *   VersionStages: Array<string>,
   * }>
   * ```
   */
  async getSecret(name) {
    const payload = JSON.stringify({
      SecretId: name,
    })
    const response =
      await this._awsRequest('POST', '/', 'GetSecretValue', payload)

    return handleAwsResponse.call(this, response, this.getSecret, name)
  }

  /**
   * @name SecretsManager.prototype.getSecretString
   *
   * @synopsis
   * ```coffeescript [specscript]
   * new SecretsManager(...).getSecretString(name string) -> SecretString string
   * ```
   */
  async getSecretString(name) {
    const secret = await this.getSecret(name)
    return secret.SecretString
  }

  /**
   * @name deleteSecret
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteSecret(name string) -> result Promise<{
   *   ARN: string,
   *   DeletionDate: Date,
   *   Name: string,
   * }>
   * ```
   */
  async deleteSecret(name) {
    const payload = JSON.stringify({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    })
    const response =
      await this._awsRequest('POST', '/', 'DeleteSecret', payload)

    return handleAwsResponse.call(this, response, this.deleteSecret, name)
  }

}

module.exports = SecretsManager
