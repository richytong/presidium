require('rubico/global')
const crypto = require('crypto')
const HTTP = require('./HTTP')
const Readable = require('./Readable')
const userAgent = require('./userAgent')
const AwsAuthorization = require('./internal/AwsAuthorization')
const AmzDate = require('./internal/AmzDate')
const AwsError = require('./internal/AwsError')
const parseURL = require('./internal/parseURL')
const createS3DeleteObjectError = require('./internal/createS3DeleteObjectError')
const XML = require('./XML')

/**
 * @name S3Bucket
 *
 * @docs
 * ```coffeescript [specscript]
 * new S3Bucket(options {
 *   name string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string
 *   BlockPublicACLs: boolean,
 *   IgnorePublicACLs: boolean,
 *   BlockPublicPolicy: boolean,
 *   RestrictPublicBuckets: boolean,
 *   RequestPayer: 'Requester'|'BucketOwner',
 *   ObjectLockEnabled: boolean,
 *   ObjectLockDefaultRetentionMode: 'COMPLIANCE'|'GOVERNANCE',
 *   ObjectLockDefaultRetentionDays: number,
 *   ObjectLockDefaultRetentionYears: number,
 *   VersioningMfaDelete: 'Enabled'|'Disabled',
 *   VersioningStatus: 'Enabled'|'Suspended',
 * }) -> s3bucket S3Bucket
 * ```
 *
 * Presidium S3Bucket client for [AWS S3](https://aws.amazon.com/s3/). Creates a new S3 Bucket under `name` if a bucket does not already exist. Access to the newly creaed S3 Bucket is private.
 *
 * S3Bucket instances have a `ready` promise that resolves when the S3 Bucket is active.
 *
 * Arguments:
 *   * `options`
 *     * `name` - globally unique name of the AWS S3 Bucket.
 *     * `accessKeyId` - long term credential (ID) of an [IAM](https://aws.amazon.com/iam/) user.
 *     * `secretAccessKey` - long term credential (secret) of an [IAM](https://aws.amazon.com/iam/) user.
 *     * `region` - geographic location of data center cluster, e.g. `us-east-1` or `us-west-2`. [Full list of AWS regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html#available-regions)
 *     * `BlockPublicACLs` - if `false`, AWS S3 does not block public access control lists (ACLs) for this bucket and objects in this bucket. Default `true`.
 *     * `IgnorePublicACLs` - if `false`, AWS S3 does not ignore public access control lists (ACLs) for this bucket and objects in this bucket. Default `true`.
 *     * `BlockPublicPolicy` - if `false`, AWS S3 does not block public bucket policies for this bucket. Default `true`.
 *     * `RestrictPublicBuckets` - if `false`, AWS S3 does not restrict public bucket policies for this bucket. Default `true`.
 *     * `RequestPayer` - the payer for requests to the AWS S3 Bucket. Defaults to `BucketOwner`.
 *     * `ObjectLockEnabled` - if `true`, AWS S3 enables Object Lock for this bucket. Defaults to `false`.
 *     * `ObjectLockDefaultRetentionMode` - the default Object Lock mode (`'GOVERNANCE'` or `'COMPLIANCE'`) for this bucket. Defaults to `'COMPLIANCE'`
 *       * `'COMPLIANCE'` - no one, including the root user, can delete a locked object.
 *       * `'GOVERNANCE'` - users with special permissions can delete a locked object.
 *     * `ObjectLockDefaultRetentionDays` - number of days that a locked object is protected by Object Lock for this bucket.
 *     * `ObjectLockDefaultRetentionYears` - number of years that a locked object is protected by Object Lock for this bucket.
 *     * `VersioningMfaDelete` - if `'Enabled'`, AWS S3 requires multifactor authentication (MFA) before permanently deleting object versions or change bucket versioning states for this bucket. Defaults to `'Disabled'`.
 *     * `VersioningStatus` - if `'Enabled'`, AWS S3 enables versioning for objects in this bucket, and all objects added to the bucket receive a unique Version ID. If `'Suspended'`, existing object versions remain in the bucket, new objects receive a `null` Version ID, and overwrites of objects behave as they would in an unversioned bucket. Defaults to `'Suspended'`.
 *
 * Return:
 *   * `s3Bucket` - an S3Bucket instance.
 *
 * ```javascript
 * const S3Bucket = require('presidium/S3Bucket')
 * const AwsCredentials = require('presidium/AwsCredentials')
 *
 * const awsCreds = await AwsCredentials('default')
 * awsCreds.region = 'us-east-1'
 *
 * const myBucket = new S3Bucket({
 *   name: 'my-bucket-name',
 *   ...awsCreds,
 * })
 * ```
 *
 */
class S3Bucket {
  constructor(options) {
    this.name = options.name

    this.accessKeyId = options.accessKeyId ?? ''
    this.secretAccessKey = options.secretAccessKey ?? ''
    this.region = options.region ?? ''
    this.apiVersion = '2012-08-10'

    this.host0 = 's3.amazonaws.com'
    this.host1 = `s3.${this.region}.amazonaws.com`
    this.endpoint0 = `s3.amazonaws.com/${this.name}`
    this.endpoint1 = `s3.${this.region}.amazonaws.com/${this.name}`
    this.protocol = 'https'

    this.http0 = new HTTP(`${this.protocol}://${this.endpoint0}`)
    this.http1 = new HTTP(`${this.protocol}://${this.endpoint1}`)

    if (options.ACL) {
      this.ACL = options.ACL
    }
    if (options.ObjectOwnership) {
      this.ObjectOwnership = options.ObjectOwnership
    }

    this.BlockPublicACLs = options.BlockPublicACLs ?? true
    this.IgnorePublicACLs = options.IgnorePublicACLs ?? true
    this.BlockPublicPolicy = options.BlockPublicPolicy ?? true
    this.RestrictPublicBuckets = options.RestrictPublicBuckets ?? true
    this.RequestPayer = options.RequestPayer ?? 'BucketOwner'

    this.ObjectLockEnabled = options.ObjectLockEnabled ?? false
    this.ObjectLockDefaultRetentionMode =
      options.ObjectLockDefaultRetentionMode // 'COMPLIANCE'|'GOVERNANCE'
    this.ObjectLockDefaultRetentionDays =
      options.ObjectLockDefaultRetentionDays
    this.ObjectLockDefaultRetentionYears =
      options.ObjectLockDefaultRetentionYears

    if (
      this.ObjectLockDefaultRetentionMode
        && this.ObjectLockDefaultRetentionDays == null
        && this.ObjectLockDefaultRetentionYears == null
    ) {
      throw new Error('ObjectLockDefaultRetentionDays or ObjectLockDefaultRetentionYears must be specified with ObjectLockDefaultRetentionMode')
    }

    this.VersioningMfaDelete = options.VersioningMfaDelete ?? 'Disabled'
    this.VersioningStatus = options.VersioningStatus ?? 'Suspended'

    /**
     * @name ready
     *
     * @docs
     * ```coffeescript [specscript]
     * ready -> promise Promise<>
     * ```
     *
     * The ready promise for the S3Bucket instance. Resolves when the S3 Bucket is active.
     *
     * ```javascript
     * const awsCreds = await AwsCredentials('default')
     * awsCreds.region = 'us-east-1'
     *
     * const myBucket = new S3Bucket({
     *   name: 'my-bucket-name',
     *   ...awsCreds,
     * })
     * await myBucket.ready
     * ```
     */
    this.autoReady = options.autoReady ?? true
    if (this.autoReady) {
      this.ready = this._readyPromise()
    }

  }

  /**
   * @name _readyPromise
   *
   * @docs
   * ```coffeescript [specscript]
   * bucket._readyPromise() -> ready Promise<>
   * ```
   */
  async _readyPromise() {
    try {
      await this.getLocation()
      return { message: 'bucket-exists' }
    } catch (error) {
      if (error.name == 'NoSuchBucket') {
        await this.create()
        await this.putPublicAccessBlock()
        await this.putRequestPayment()
        if (this.VersioningStatus == 'Enabled') {
          await this.putVersioning()
        }
        if (this.ObjectLockEnabled) {
          await this.putObjectLockConfiguration()
        }
        return { message: 'created-bucket' }
      } else {
        throw error
      }
    }
  }

  /**
   * @name _awsRequest0
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * table._awsRequest0(
   *   method string,
   *   url string,
   *   headers object
   *   body string
   * ) -> response Promise<http.ServerResponse>
   * ```
   */
  _awsRequest0(method, url, headers, body) {
    const amzDate = AmzDate()
    const payloadHash =
      crypto.createHash('sha256').update(body, 'utf8').digest('hex')
    const urlData = parseURL(url)

    headers = {
      'Host': this.host0,
      'X-Amz-Content-SHA256': payloadHash,
      'X-Amz-Date': amzDate,
      'Date': new Date().toUTCString(),
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      'User-Agent': userAgent,
      ...headers,
    }

    const amzHeaders = {}
    for (const key in headers) {
      if (key.toLowerCase().startsWith('x-amz')) {
        amzHeaders[key] = headers[key]
      }
    }

    const authorizationHeaders = {
      'Host': this.host0,
      ...headers['Content-MD5'] ? {
        'Content-MD5': headers['Content-MD5']
      } : {},
      ...amzHeaders
    }

    headers['Authorization'] = AwsAuthorization({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      method,
      endpoint: this.endpoint0,
      protocol: this.protocol,
      canonicalUri: `/${this.name}${urlData.pathname}`,
      serviceName: 's3',
      payloadHash,
      expires: 300,
      queryParams: urlData.searchParams,
      headers: authorizationHeaders,
    })

    return this.http0[method](url, { headers, body })
  }

  /**
   * @name _awsRequest1
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * table._awsRequest1(
   *   method string,
   *   url string,
   *   headers object
   *   body string
   * ) -> response Promise<http.ServerResponse>
   * ```
   */
  _awsRequest1(method, url, headers, body) {
    const amzDate = AmzDate()
    const payloadHash =
      crypto.createHash('sha256').update(body, 'utf8').digest('hex')
    const urlData = parseURL(url)

    headers = {
      'Host': this.host1,
      'X-Amz-Content-SHA256': payloadHash,
      'X-Amz-Date': amzDate,
      'Date': new Date().toUTCString(),
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      'User-Agent': userAgent,
      ...headers,
    }

    const amzHeaders = {}
    for (const key in headers) {
      if (key.toLowerCase().startsWith('x-amz')) {
        amzHeaders[key] = headers[key]
      }
    }

    const authorizationHeaders = {
      'Host': this.host1,
      ...headers['Content-MD5'] ? {
        'Content-MD5': headers['Content-MD5']
      } : {},
      ...amzHeaders
    }

    headers['Authorization'] = AwsAuthorization({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      method,
      endpoint: this.endpoint1,
      protocol: this.protocol,
      canonicalUri: `/${this.name}${urlData.pathname}`,
      serviceName: 's3',
      payloadHash,
      expires: 300,
      queryParams: urlData.searchParams,
      headers: authorizationHeaders,
    })

    return this.http1[method](url, { headers, body })
  }

  /**
   * @name getLocation
   *
   * @docs
   * ```coffeescript [specscript]
   * bucket.getLocation() -> data Promise<{
   *   LocationConstraint: string|null
   * }>
   * ```
   */
  async getLocation() {
    const response = await this._awsRequest0('GET', '/?location', {}, '')

    if (response.ok) {
      const text = await Readable.Text(response)
      const data = XML.parse(text)
      return {
        LocationConstraint: typeof data.LocationConstraint == 'string'
          ? data.LocationConstraint
          : null
      }
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name create
   *
   * @docs
   * ```coffeescript [specscript]
   * bucket.create() -> data Promise<{}>
   * ```
   *
   * Create the AWS S3 Bucket.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data` - a promise of an empty object.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myBucket.create()
   * ```
   */
  async create() {
    const headers = {}

    /*
    if (this.ACL) {
      headers['X-Amz-ACL'] = this.ACL
    }
    */

    if (this.ObjectOwnership) {
      headers['X-Amz-Object-Ownership'] = this.ObjectOwnership
    }
    if (this.GrantFullControl) {
      headers['X-Amz-Grant-Full-Control'] = this.GrantFullControl
    }

    const body = this.region == 'us-east-1' ? '' : `
<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"> 
  <LocationConstraint>${this.region}</LocationConstraint>
</CreateBucketConfiguration >
    `.trim()

    const response = await this._awsRequest1('PUT', '/', headers, body)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putPublicAccessBlock
   *
   * @docs
   * ```coffeescript [specscript]
   * putPublicAccessBlock() -> data Promise<{}>
   * ```
   *
   * Create or replace the `PublicAccessBlock` configuration for the AWS S3 Bucket.
   *
   */
  async putPublicAccessBlock() {
    const headers = {}

    const body = `
<?xml version="1.0" encoding="UTF-8"?>
<PublicAccessBlockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
   <BlockPublicAcls>${this.BlockPublicACLs}</BlockPublicAcls>
   <IgnorePublicAcls>${this.IgnorePublicACLs}</IgnorePublicAcls>
   <BlockPublicPolicy>${this.BlockPublicPolicy}</BlockPublicPolicy>
   <RestrictPublicBuckets>${this.RestrictPublicBuckets}</RestrictPublicBuckets>
</PublicAccessBlockConfiguration>
    `.trim()

    headers['Content-MD5'] = crypto.createHash('md5').update(body).digest('base64')

    const response = await this._awsRequest1('PUT', '/?publicAccessBlock', headers, body)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putRequestPayment
   *
   * @docs
   * ```coffeescript [specscript]
   * putRequestPayment() -> data Promise<{}> 
   * ```
   *
   * Create or replace the `RequestPayment` configuration for the AWS S3 Bucket.
   *
   */
  async putRequestPayment() {
    const headers = {}

    const body = `
<?xml version="1.0" encoding="UTF-8"?>
<RequestPaymentConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Payer>${this.RequestPayer}</Payer>
</RequestPaymentConfiguration>
    `.trim()

    headers['Content-MD5'] = crypto.createHash('md5').update(body).digest('base64')

    const response = await this._awsRequest1('PUT', '/?requestPayment', headers, body)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putObjectLockConfiguration
   *
   * @docs
   * ```coffeescript [specscript]
   * putObjectLockConfiguration() -> Promise<{}>
   * ```
   *
   * Apply an AWS S3 Bucket policy to an AWS S3 Bucket.
   *
   */
  async putObjectLockConfiguration() {
    const headers = {}

    const body = `
<?xml version="1.0" encoding="UTF-8"?>
<ObjectLockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
   <ObjectLockEnabled>Enabled</ObjectLockEnabled>
   ${this.ObjectLockDefaultRetentionMode ? `
   <Rule>
      <DefaultRetention>
         <Mode>${this.ObjectLockDefaultRetentionMode}</Mode>
         ${
           this.ObjectLockDefaultRetentionDays == null
             ? `<Years>${this.ObjectLockDefaultRetentionYears}</Years>`
             : `<Days>${this.ObjectLockDefaultRetentionDays}</Days>`
         }
      </DefaultRetention>
   </Rule>
   ` : ''}
</ObjectLockConfiguration>
    `.trim()

    headers['Content-MD5'] = crypto.createHash('md5').update(body).digest('base64')

    const response = await this._awsRequest0('PUT', '/?object-lock', headers, body)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putVersioning
   *
   * @docs
   * ```coffeescript [specscript]
   * putVersioning() -> Promise<{}>
   * ```
   *
   * Apply an AWS S3 Bucket policy to an AWS S3 Bucket.
   *
   */
  async putVersioning() {
    const headers = {}

    const body = `
<?xml version="1.0" encoding="UTF-8"?>
<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
   <MfaDelete>${this.VersioningMfaDelete}</MfaDelete>
   <Status>${this.VersioningStatus}</Status>
</VersioningConfiguration>
    `.trim()

    headers['Content-MD5'] = crypto.createHash('md5').update(body).digest('base64')

    const response = await this._awsRequest0('PUT', '/?versioning', headers, body)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putPolicy
   *
   * @docs
   * ```coffeescript [specscript]
   * putPolicy(options {
   *   policy: object,
   * }) -> data Promise<{}>
   * ```
   *
   * Apply an [AWS Access Policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html) to an AWS S3 Bucket.
   *
   * Arguments:
   *   * `options`
   *     * `policy` - the access policy object
   *
   * Return:
   *   * `data` - a promise of an empty object.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * await myBucket.putPolicy({
   *   "Version": "2012-10-17",
   *   "Statement": [
   *     {
   *       "Effect": "Allow",
   *       "Principal": {
   *         "AWS": "arn:aws:iam::AccountA-ID:root"
   *       },
   *       "Action": "sts:AssumeRole"
   *     }
   *   ]
   * })
   * ```
   */
  async putPolicy(options) {
    const { policy } = options

    const body = JSON.stringify(policy)

    const response = await this._awsRequest0('PUT', '/?policy', {}, body)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name getPolicy
   *
   * @docs
   * ```coffeescript [specscript]
   * getPolicy() -> BucketPolicy Promise<{
   *   Version: string,
   *   Id: string,
   *   Statement: Array,
   * }>
   * ```
   *
   * Returns the [AWS Access Policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html) of an AWS S3 Bucket.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `BucketPolicy` - a promise of the bucket's access policy.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * const policy = await myBucket.getPolicy()
   * ```
   */
  async getPolicy() {
    const response = await this._awsRequest0('GET', '/?policy', {}, '')

    if (response.ok) {
      const data = await Readable.JSON(response)
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name closeConnections
   *
   * @docs
   * ```coffeescript [specscript]
   * closeConnections() -> undefined
   * ```
   *
   * Closes underlying TCP connections.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * undefined
   */
  closeConnections() {
    this.http0.closeConnections()
    this.http1.closeConnections()
  }

  /**
   * @name delete
   *
   * @docs
   * ```coffeescript [specscript]
   * bucket.delete() -> data Promise<{}>
   * ```
   *
   * Deletes an AWS S3 Bucket.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data` - a promise of an empty object.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myBucket.delete()
   * ```
   *
   */
  async delete(options = {}) {
    const response = await this._awsRequest1('DELETE', '/', {}, '')

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putObject
   *
   * @docs
   * ```coffeescript [specscript]
   * type DateString = string # Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
   * type TimestampSeconds = number # 1751111429
   *
   * bucket.putObject(
   *   key string,
   *   body Buffer|TypedArray|Blob|string|ReadableStream,
   *   options {
   *     ACL: 'private'|'public-read'|'public-read-write'|'authenticated-read'
   *          |'aws-exec-read'|'bucket-owner-read'|'bucket-owner-full-control',
   *     CacheControl: string,
   *     ContentDisposition: string,
   *     ContentEncoding: string,
   *     ContentLanguage: string,
   *     ContentLength: number,
   *     ContentMD5: string,
   *     ContentType: string,
   *     ChecksumAlgorithm: 'CRC32'|'CRC32C'|'SHA1'|'SHA256',
   *     ChecksumCRC32: string,
   *     ChecksumCRC32C: string,
   *     ChecksumCRC64NVME: string,
   *     ChecksumSHA1: string,
   *     ChecksumSHA256: string,
   *     Expires: Date|DateString|TimestampSeconds,
   *     IfNoneMatch: '*',
   *     GrantFullControl: string,
   *     GrantRead: string,
   *     GrantReadACP: string,
   *     GrantWriteACP: string,
   *     Metadata: Object<string>,
   *     ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'
   *                   |'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *                   |'GLACIER_IR'|'SNOW'|'EXPRESS_ONEZONE',
   *     WebsiteRedirectLocation: string,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: Buffer|TypedArray|Blob|string,
   *     SSECustomerKeyMD5: string,
   *     SSEKMSKeyId: string,
   *     SSEKMSEncryptionContext: string,
   *     BucketKeyEnabled: boolean,
   *     RequestPayer: 'Requester'|'BucketOwner'
   *     Tagging: string, # key1=value1&key2=value2
   *     ObjectLockMode: 'GOVERNANCE'|'COMPLIANCE',
   *     ObjectLockRetainUntilDate: Date|DateString|TimestampSeconds,
   *     ObjectLockLegalHoldStatus: 'ON'|'OFF',
   *   }
   * ) -> data Promise<{
   *   Expiration: string,
   *   ETag: string,
   *   ChecksumCRC32: string,
   *   ChecksumCRC32C: string,
   *   ChecksumCRC64NVME: string,
   *   ChecksumSHA1: string,
   *   ChecksumSHA256: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *   VersionId: string,
   *   SSECustomerAlgorithm: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *   SSECustomerKeyMD5: string,
   *   SSEKMSKeyId: string,
   *   SSEKMSEncryptionContext: string,
   *   BucketKeyEnabled: boolean,
   * }>
   * ```
   *
   * Puts an object in the AWS S3 Bucket.
   *
   * Arguments:
   *   * `key` - the key of the object inside the bucket. An object key is essentially the path to the object inside a bucket without the leading slash.
   *   * `body` - the content of the object.
   *   * `options`
   *     * `ACL` - the [canned access control list (ACL)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html#canned-acl) to apply to the object. For more information, see [Access control list (ACL) overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html) from the _Amazon S3 User Guide_.
   *     * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *     * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *     * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *     * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *     * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *     * `ContentMD5` - the base64-encoded 128-bit MD5 digest of the object. For more information, see [RFC 1864](https://datatracker.ietf.org/doc/html/rfc1864).
   *     * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *     * `ChecksumAlgorithm`- indicates the algorithm used to create the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC64NVME` - the base64-encoded, 64-bit CRC-64NVME [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `Expires` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *     * `IfNoneMatch` - uploads the object only if the object key name does not already exist in the bucket. Otherwise, Amazon S3 responds with `412 Precondition Failed`. If a conflicting operation occurs during the upload, Amazon S3 responds with `409 ConditionalRequestConflict`. For more information, see [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232) and [Add preconditions to S3 operations with conditional requests](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html).
   *     * `GrantFullControl` - gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object.
   *     * `GrantRead` - allows the grantee to read the object data and its metadata.
   *     * `GrantReadACP` - allows the grantee to read the object ACL.
   *     * `GrantWriteACP` - allows the grantee to write the ACL for the applicable object.
   *     * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *     * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *     * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *     * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption. If a KMS key doesn't exist in the same account, this value must be the Key ARN.
   *     * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information used for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *     * `BucketKeyEnabled` - if `true`, Amazon S3 uses the Amazon S3 Bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *     * `Tagging` - the [tag-set](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/what-are-tags.html) for the object encoded as URL query paramters (e.g. "Key1=Value1&Key2=Value2).
   *     * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockLegalHoldStatus` - if `true`, a legal hold will be applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *
   * Return:
   *   * `data`
   *     * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *     * `ETag` - the entity tag or MD5 hash of the object.
   *     * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC64NVME` - the base64-encoded, 64-bit CRC-64NVME [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumType` - the checksum type of the object, which determines how part-level checksums are combined to create an object-level checksum for multipart objects. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *     * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *     * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information used for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *     * `BucketKeyEnabled` - indicates that Amazon S3 used the Amazon S3 Bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * await myBucket.putObject('some-key', '{"hello":"world"}', {
   *   ContentType: 'application/json',
   * })
   * ```
   *
   */
  async putObject(key, body, options = {}) {
    const headers = {}

    if (options.ACL) {
      headers['X-Amz-ACL'] = options.ACL
    }
    if (options.CacheControl) {
      headers['Cache-Control'] = options.CacheControl
    }

    if (options.ContentDisposition) {
      headers['Content-Disposition'] = options.ContentDisposition
    }
    if (options.ContentEncoding) {
      headers['Content-Encoding'] = options.ContentEncoding
    }

    if (options.ContentLanguage) {
      headers['Content-Language'] = options.ContentLanguage
    }
    if (options.ContentLength) {
      headers['Content-Length'] = options.ContentLength
    }

    if (options.ContentMD5) {
      headers['Content-MD5'] = options.ContentMD5
    } else {
      headers['Content-MD5'] = crypto.createHash('md5').update(body).digest('base64')
    }

    if (options.ContentType) {
      headers['Content-Type'] = options.ContentType
    } else {
      headers['Content-Type'] = 'application/octet-stream'
    }

    if (options.ChecksumAlgorithm) {
      headers['X-Amz-Checksum-Algorithm'] = options.ChecksumAlgorithm
    }
    if (options.ChecksumCRC32) {
      headers['X-Amz-Checksum-CRC32'] = options.ChecksumCRC32
    }

    if (options.ChecksumCRC32C) {
      headers['X-Amz-Checksum-CRC32C'] = options.ChecksumCRC32C
    }
    if (options.ChecksumCRC64NVME) {
      headers['X-Amz-Checksum-CRC64NVME'] = options.ChecksumCRC64NVME
    }

    if (options.ChecksumSHA1) {
      headers['X-Amz-Checksum-SHA1'] = options.ChecksumSHA1
    }
    if (options.ChecksumSHA256) {
      headers['X-Amz-Checksum-SHA256'] = options.ChecksumSHA256
    }

    if (options.Expires) {
      headers['Expires'] = options.Expires
    }
    if (options.IfNoneMatch) {
      headers['If-None-Match'] = options.IfNoneMatch
    }

    if (options.GrantFullControl) {
      headers['X-Amz-Grant-Full-Control'] = options.GrantFullControl
    }
    if (options.GrantRead) {
      headers['X-Amz-Grant-Read'] = options.GrantRead
    }

    if (options.GrantReadACP) {
      headers['X-Amz-Grant-Read-ACP'] = options.GrantReadACP
    }
    if (options.GrantWriteACP) {
      headers['X-Amz-Grant-Write-ACP'] = options.GrantWriteACP
    }

    if (options.ServerSideEncryption) {
      headers['X-Amz-Server-Side-Encryption'] = options.ServerSideEncryption
    }
    if (options.StorageClass) {
      headers['X-Amz-Storage-Class'] = options.StorageClass
    }
    if (options.WebsiteRedirectLocation) {
      headers['X-Amz-Website-Redirect-Location'] = options.WebsiteRedirectLocation
    }

    if (options.SSECustomerAlgorithm) {
      headers['X-Amz-Server-Side-Encryption-Customer-Algorithm'] =
        options.SSECustomerAlgorithm
    }
    if (options.SSECustomerKey) {
      headers['X-Amz-Server-Side-Encryption-Customer-Key'] =
        options.SSECustomerKey
    }
    if (options.SSECustomerKeyMD5) {
      headers['X-Amz-Server-Side-Encryption-Customer-Key-MD5'] =
        options.SSECustomerKeyMD5
    }

    if (options.SSEKMSKeyId) {
      headers['X-Amz-Server-Side-Encryption-AWS-KMS-Key-ID'] = options.SSEKMSKeyId
    }
    if (options.SSEKMSEncryptionContext) {
      headers['X-Amz-Server-Side-Encryption-Context'] =
        options.SSEKMSEncryptionContext
    }

    if (options.BucketKeyEnabled) {
      headers['X-Amz-Server-Side-Encryption-Bucket-Key-Enabled'] =
        options.BucketKeyEnabled
    }

    if (options.Tagging) {
      headers['X-Amz-Tagging'] = options.Tagging
    }
    if (options.ObjectLockMode) {
      headers['X-Amz-Object-Lock-Mode'] = options.ObjectLockMode
    }

    if (options.ObjectLockRetainUntilDate) {
      headers['X-Amz-Object-Lock-Retain-Until-Date'] =
        options.ObjectLockRetainUntilDate
    }
    if (options.ObjectLockLegalHoldStatus) {
      headers['X-Amz-Object-Lock-Legal-Hold'] =
        options.ObjectLockLegalHoldStatus
    }

    const response = await this._awsRequest1('PUT', `/${key}`, headers, body)

    if (response.ok) {
      const data = {}

      if (response.headers['etag']) {
        data.ETag = response.headers['etag']
      }

      /* TODO
      // https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html;
      // Sample Response for general purpose buckets: Expiration rule created using lifecycle configuration
      if (response.headers['x-amz-expiration']) {
        data.Expiration = response.headers['x-amz-expiration']
      }
      */

      if (response.headers['x-amz-checksum-crc32']) {
        data.ChecksumCRC32 = response.headers['x-amz-checksum-crc32']
      }
      if (response.headers['x-amz-checksum-crc32c']) {
        data.ChecksumCRC32C = response.headers['x-amz-checksum-crc32c']
      }

      if (response.headers['x-amz-checksum-crc64nvme']) {
        data.ChecksumCRC64NVME = response.headers['x-amz-checksum-crc64nvme']
      }
      if (response.headers['x-amz-checksum-sha1']) {
        data.ChecksumSHA1 = response.headers['x-amz-checksum-sha1']
      }

      if (response.headers['x-amz-checksum-sha256']) {
        data.ChecksumSHA256 = response.headers['x-amz-checksum-sha256']
      }
      if (response.headers['x-amz-checksum-type']) {
        data.ChecksumType = response.headers['x-amz-checksum-type']
      }

      if (response.headers['x-amz-server-side-encryption']) {
        data.ServerSideEncryption = response.headers['x-amz-server-side-encryption']
      }
      if (response.headers['x-amz-version-id']) {
        data.VersionId = response.headers['x-amz-version-id']
      }

      if (response.headers['x-amz-server-side-encryption-customer-algorithm']) {
        data.SSECustomerAlgorithm =
          response.headers['x-amz-server-side-encryption-customer-algorithm']
      }
      if (response.headers['x-amz-server-side-encryption-customer-key-md5']) {
        data.SSECustomerKeyMD5 =
          response.headers['x-amz-server-side-encryption-customer-key-md5']
      }

      if (response.headers['x-amz-server-side-encryption-aws-kms-key-id']) {
        data.SSEKMSKeyId =
          response.headers['x-amz-server-side-encryption-aws-kms-key-id']
      }
      if (response.headers['x-amz-server-side-encryption-context']) {
        data.SSEKMSEncryptionContext =
          response.headers['x-amz-server-side-encryption-context']
      }

      if (response.headers['x-amz-server-side-encryption-bucket-key-enabled']) {
        data.BucketKeyEnabled =
          response.headers['x-amz-server-side-encryption-bucket-key-enabled'] == 'true'
      }

      await Readable.Text(response)
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name getObject
   *
   * @docs
   * ```coffeescript [specscript]
   * type DateString = string # Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
   * type TimestampSeconds = number # 1751111429
   *
   * getObject(
   *   key string,
   *   options {
   *     Stream: boolean,
   *     IfMatch: string,
   *     IfModifiedSince: Date|DateString|TimestampSeconds,
   *     IfNoneMatch: string,
   *     IfUnmodifiedSince: Date|DateString|TimestampSeconds,
   *     Range: string, # 'bytes=0-9'
   *     ResponseCacheControl: string,
   *     ResponseContentDisposition: string,
   *     ResponseContentEncoding: string,
   *     ResponseContentLanguage: string,
   *     ResponseContentType: string,
   *     ResponseExpires: Date|Date.toString()|number,
   *     VersionId: string,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: Buffer|TypedArray|Blob|string,
   *     SSECustomerKeyMD5: string,
   *     PartNumber: number,
   *     ChecksumMode: 'ENABLED',
   *   },
   * ) -> data Promise<{
   *   Body: Buffer|TypedArray|ReadableStream,
   *   DeleteMarker: boolean,
   *   AcceptRanges: string,
   *   Expiration: string,
   *   Restore: string,
   *   LastModified: Date,
   *   ContentLength: number,
   *   ETag: string,
   *   ChecksumCRC32: string,
   *   ChecksumCRC32C: string,
   *   ChecksumCRC64NVME: string,
   *   ChecksumSHA1: string,
   *   ChecksumSHA256: string,
   *   MissingMeta: number,
   *   VersionId: string,
   *   CacheControl: string,
   *   ContentDisposition: string,
   *   ContentEncoding: string,
   *   ContentLanguage: string,
   *   ContentRange: string,
   *   ContentType: string,
   *   Expires: Date,
   *   ExpiresString: string,
   *   WebsiteRedirectLocation: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *   Metadata: Object<string>,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKeyMD5: string,
   *   SSEKMSKeyId: string,
   *   BucketKeyEnabled: boolean,
   *   StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'
   *                 |'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *                 |'GLACIER_IR'|'SNOW'|'EXPRESS_ONEZONE',
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA'|'COMPLETED',
   *   PartsCount: number,
   *   TagCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|DateString|TimestampSeconds,
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF'
   * }>
   * ```
   *
   * Retrieves an object from the AWS S3 Bucket.
   *
   * Arguments:
   *   * `key` - the key of the object inside the bucket. An object key is essentially the path to the object inside a bucket without the leading slash.
   *   * `body` - the content of the object.
   *   * `options`
   *     * `Stream` - if `true`, response body is returned as a Node.js ReadableStream
   *     * `IfMatch` - if the entity tag (ETag) in the response is different than the one specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. For more information, see [If-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1).
   *     * `IfModifiedSince` - if the object has not been modified since the time specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. If the `IfNoneMatch` option is specified, this option is ignored. For more information, see [If-Modified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3).
   *     * `IfNoneMatch` - if the object has the same entity tag (ETag) as the one specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. For more information, see [If-None-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2).
   *     * `IfUnmodifiedSince` - if the object has been modified since the time specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. If the `IfMatch` option is specified, this option is ignored. For more information, see [If-Unmodified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4).
   *     * `Range` - download only the byte range of the object specified by this option. For more information, see [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2).
   *     * `ResponseCacheControl` - sets the [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2) header of the response.
   *     * `ResponseContentDisposition` - sets the [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266) header of the response.
   *     * `ResponseContentEncoding` - sets the [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4) header of the response.
   *     * `ResponseContentLanguage` - sets the [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5) header of the response.
   *     * `ResponseContentType` - sets the [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3) header of the response.
   *     * `ResponseExpires` - sets the [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3) header of the response.
   *     * `VersionId` - the specific version of the object. If the version of the object specified by this option is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html), Amazon S3 responds with HTTP status code `405 Method Not Allowed`. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `PartNumber` - (TODO) part number of the object being read. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumMode` - required to retrieve the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object.
   *
   * Return:
   *   * `data`
   *     * `Body` - the object data.
   *     * `DeleteMarker` - if `true`, the current version or specified object version is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html).
   *     * `AcceptRanges` - the range of bytes specified by the [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2) header of the request.
   *     * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *     * `Restore` - provides information about the object restoration action and expiration time of the restored object copy. For more information, see [Restoring an archived object](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html) from the _Amazon S3 User Guide_.
   *     * `LastModified` - date/time when the object was last modified.
   *     * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *     * `ETag` - the entity tag or MD5 hash of the object.
   *     * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC64NVME` - the base64-encoded, 64-bit CRC-64NVME [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `MissingMeta` - the number of metadata entries not returned in the headers that are prefixed with `x-amz-meta-`. For more information, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *     * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *     * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *     * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *     * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *     * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *     * `ContentRange` - the portion of the object returned in the response. For more information, see [Content-Range](https://datatracker.ietf.org/doc/html/rfc7233#section-4.2)
   *     * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *     * `Expires` - deprecated in favor of `ExpiresString`.
   *     * `ExpiresString` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *     * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *     * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *     * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *     * `BucketKeyEnabled` - indicates that Amazon S3 used the Amazon S3 Bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *     * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *     * `ReplicationStatus` - (TODO) the progress of replicating objects between buckets. For more information, see [Replicating objects within and across Regions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html).
   *     * `PartsCount` - (TODO) the parts count of the object. This value is only returned if the `PartNumber` option was specified and the object was uploaded as a multipart upload. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *     * `TagCount` - the number of tags on the object.
   *     * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockLegalHoldStatus` - indicates the status of the legal hold applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * const data = await myBucket.getObject('my-key')
   *
   * function myHTTPHandler(request, response) {
   *   const myObjectStream = await myBucket.getObject('my-file-key', {
   *     Stream: true,
   *     Range: 'bytes=0-1000000',
   *   })
   *
   *   myObjectStream.on('data', chunk => {
   *     response.write(chunk)
   *   })
   *   myObjectStream.on('close', () => {
   *     response.end()
   *   })
   *   myObjectStream.on('error', error => {
   *     console.error(error)
   *     response.end()
   *   })
   * }
   * ```
   *
   */
  async getObject(key, options = {}) {
    const headers = {}

    if (options.IfMatch) {
      headers['If-Match'] = options.IfMatch
    }
    if (options.IfModifiedSince) {
      headers['If-Modified-Since'] = options.IfModifiedSince
    }

    if (options.IfNoneMatch) {
      headers['If-None-Match'] = options.IfNoneMatch
    }
    if (options.IfUnmodifiedSince) {
      headers['If-Unmodified-Since'] = options.IfUnmodifiedSince
    }

    if (options.Range) {
      headers['Range'] = options.Range
    }

    if (options.SSECustomerAlgorithm) {
      headers['X-Amz-Server-Side-Encryption-Customer-Algorithm'] =
        options.SSECustomerAlgorithm
    }

    if (options.SSECustomerKey) {
      headers['X-Amz-Server-Side-Encryption-Customer-Key'] =
        options.SSECustomerKey
    }

    if (options.SSECustomerKeyMD5) {
      headers['X-Amz-Server-Side-Encryption-Customer-Key-MD5'] =
        options.SSECustomerKeyMD5
    }

    if (options.ChecksumMode) {
      headers['X-Amz-Checksum-Mode'] = options.ChecksumMode
    }

    const searchParams = new URLSearchParams()

    /* TODO
    if (options.PartNumber) {
      searchParams.set('partNumber', options.PartNumber)
    }
    */

    if (options.ResponseCacheControl) {
      searchParams.set('response-cache-control', options.ResponseCacheControl)
    }

    if (options.ResponseContentDisposition) {
      searchParams.set(
        'response-content-disposition',
        options.ResponseContentDisposition
      )
    }

    if (options.ResponseContentEncoding) {
      searchParams.set(
        'response-content-encoding',
        options.ResponseContentEncoding
      )
    }

    if (options.ResponseContentLanguage) {
      searchParams.set(
        'response-content-language',
        options.ResponseContentLanguage
      )
    }

    if (options.ResponseContentType) {
      searchParams.set('response-content-type', options.ResponseContentType)
    }
    if (options.ResponseExpires) {
      searchParams.set('response-expires', new Date(options.ResponseExpires).toISOString())
    }
    if (options.VersionId) {
      searchParams.set('versionId', options.VersionId)
    }

    const response = await this._awsRequest1(
      'GET',
      searchParams.size > 0
        ? `/${key}?${searchParams.toString()}`
        : `/${key}`,
      headers,
      ''
    )

    if (response.ok) {
      const data = {}

      if (response.headers['accept-ranges']) {
        data.AcceptRanges = response.headers['accept-ranges']
      }

      if (response.headers['x-amz-expiration']) {
        data.Expiration = response.headers['x-amz-expiration']
      }
      if (response.headers['x-amz-restore']) {
        data.Restore = response.headers['x-amz-restore']
      }

      if (response.headers['last-modified']) {
        data.LastModified = response.headers['last-modified']
      }
      if (response.headers['content-length']) {
        data.ContentLength = response.headers['content-length']
      }

      if (response.headers['etag']) {
        data.ETag = response.headers['etag']
      }
      if (response.headers['x-amz-checksum-crc32']) {
        data.ChecksumCRC32 = response.headers['x-amz-checksum-crc32']
      }

      if (response.headers['x-amz-checksum-crc32c']) {
        data.ChecksumCRC32C = response.headers['x-amz-checksum-crc32c']
      }
      if (response.headers['x-amz-checksum-crc64nvme']) {
        data.ChecksumCRC64NVME = response.headers['x-amz-checksum-crc64nvme']
      }

      if (response.headers['x-amz-checksum-sha1']) {
        data.ChecksumSHA1 = response.headers['x-amz-checksum-sha1']
      }
      if (response.headers['x-amz-checksum-sha256']) {
        data.ChecksumSHA256 = response.headers['x-amz-checksum-sha256']
      }

      if (response.headers['x-amz-checksum-type']) {
        data.ChecksumType = response.headers['x-amz-checksum-type']
      }

      if (response.headers['x-amz-missing-meta']) {
        data.MissingMeta = response.headers['x-amz-missing-meta']
      }
      if (response.headers['x-amz-version-id']) {
        data.VersionId = response.headers['x-amz-version-id']
      }

      if (response.headers['cache-control']) {
        data.CacheControl = response.headers['cache-control']
      }
      if (response.headers['content-disposition']) {
        data.ContentDisposition = response.headers['content-disposition']
      }

      if (response.headers['content-encoding']) {
        data.ContentEncoding = response.headers['content-encoding']
      }
      if (response.headers['content-language']) {
        data.ContentLanguage = response.headers['content-language']
      }

      if (response.headers['content-range']) {
        data.ContentRange = response.headers['content-range']
      }
      if (response.headers['content-type']) {
        data.ContentType = response.headers['content-type']
      }
      if (response.headers['expires']) {
        data.Expires = response.headers['expires']
      }

      if (response.headers['x-amz-website-redirect-location']) {
        data.WebsiteRedirectLocation =
          response.headers['x-amz-website-redirect-location']
      }
      if (response.headers['x-amz-server-side-encryption']) {
        data.ServerSideEncryption =
          response.headers['x-amz-server-side-encryption']
      }

      if (response.headers['x-amz-server-side-encryption-customer-algorithm']) {
        data.SSECustomerAlgorithm =
          response.headers['x-amz-server-side-encryption-customer-algorithm']
      }

      if (response.headers['x-amz-server-side-encryption-customer-key-md5']) {
        data.SSECustomerKeyMD5 =
          response.headers['x-amz-server-side-encryption-customer-key-md5']
      }

      if (response.headers['x-amz-server-side-encryption-aws-kms-key-id']) {
        data.SSEKMSKeyId =
          response.headers['x-amz-server-side-encryption-aws-kms-key-id']
      }

      if (response.headers['x-amz-server-side-encryption-bucket-key-enabled']) {
        data.BucketKeyEnabled =
          response.headers['x-amz-server-side-encryption-bucket-key-enabled'] == 'true'
      }

      if (response.headers['x-amz-storage-class']) {
        data.StorageClass = response.headers['x-amz-storage-class']
      }

      /* TODO
      if (response.headers['x-amz-replication-status']) {
        data.ReplicationStatus = response.headers['x-amz-replication-status']
      }
      */

      /* TODO
      if (response.headers['x-amz-mp-parts-count']) {
        data.PartsCount = response.headers['x-amz-mp-parts-count']
      }
      */

      if (response.headers['x-amz-tagging-count']) {
        data.TagCount = response.headers['x-amz-tagging-count']
      }

      if (response.headers['x-amz-object-lock-mode']) {
        data.ObjectLockMode = response.headers['x-amz-object-lock-mode']
      }
      if (response.headers['x-amz-object-lock-retain-until-date']) {
        data.ObjectLockRetainUntilDate =
          response.headers['x-amz-object-lock-retain-until-date']
      }
      if (response.headers['x-amz-object-lock-legal-hold']) {
        data.ObjectLockLegalHoldStatus =
          response.headers['x-amz-object-lock-legal-hold']
      }

      if (options.Stream) {
        data.Body = response
      } else {
        data.Body = await Readable.Buffer(response)
      }

      return data
    }

    const errorData = {}
    if (response.headers['x-amz-delete-marker']) {
      errorData.DeleteMarker = response.headers['x-amz-delete-marker'] == 'true'
    }
    throw new AwsError(await Readable.Text(response), response.status, errorData)
  }

  /**
   * @name getObjectACL
   *
   * @docs
   * ```coffeescript [specscript]
   * getObjectACL(key string) -> data Promise<{
   *   Grants: Array<{
   *     Grantee: {
   *       DisplayName: string,
   *       ID: string,
   *       Type: string
   *     },
   *     Permission: string
   *   }>
   * }>
   * ```
   *
   * Retrieve the access control list (ACL) of an object from the AWS S3 Bucket.
   */
  async getObjectACL(key, options = {}) {
    const headers = {}

    const searchParams = new URLSearchParams()

    if (options.VersionId) {
      searchParams.set('versionId', options.VersionId)
    }

    const response = await this._awsRequest1(
      'GET',
      searchParams.size > 0
        ? `/${key}?acl&${searchParams.toString()}`
        : `/${key}?acl`,
      headers,
      ''
    )

    if (response.ok) {
      const data = {}

      const text = await Readable.Text(response)
      const xmlData = XML.parse(text)
      let Grants = xmlData.AccessControlPolicy?.AccessControlList?.Grant
      if (!Array.isArray(Grants)) {
        Grants = [Grants]
      }
      for (const Grant of Grants) {
        Grant.Grantee.Type = Grant.Grantee['xsi:type']
        delete Grant.Grantee['xmlns:xsi']
        delete Grant.Grantee['xsi:type']
      }
      data.Grants = Grants
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name headObject
   *
   * @docs
   * ```coffeescript [specscript]
   * headObject(
   *   key string,
   *   options {
   *     IfMatch: string,
   *     IfModifiedSince: Date|DateString|TimestampSeconds,
   *     IfNoneMatch: string,
   *     IfUnmodifiedSince: Date|DateString|TimestampSeconds,
   *     Range: string, # 'bytes=0-9'
   *     VersionId: string,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: Buffer|TypedArray|Blob|string,
   *     SSECustomerKeyMD5: string,
   *     PartNumber: number,
   *     ChecksumMode: 'ENABLED',
   *   },
   * ) -> data Promise<{
   *   DeleteMarker: boolean,
   *   AcceptRanges: string,
   *   Expiration: string,
   *   Restore: string,
   *   ArchiveStatus: 'ARCHIVE_ACCESS|DEEP_ARCHIVE_ACCESS',
   *   LastModified: Date,
   *   ContentLength: number,
   *   ETag: string,
   *   ChecksumCRC32: string,
   *   ChecksumCRC32C: string,
   *   ChecksumCRC64NVME: string,
   *   ChecksumSHA1: string,
   *   ChecksumSHA256: string,
   *   MissingMeta: number,
   *   VersionId: string,
   *   CacheControl: string,
   *   ContentDisposition: string,
   *   ContentEncoding: string,
   *   ContentLanguage: string,
   *   ContentRange: string,
   *   ContentType: string,
   *   Expires: Date,
   *   ExpiresString: string,
   *   WebsiteRedirectLocation: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *   Metadata: Object<string>,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKeyMD5: string,
   *   SSEKMSKeyId: string,
   *   BucketKeyEnabled: boolean,
   *   StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'
   *                 |'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *                 |'GLACIER_IR'|'SNOW'|'EXPRESS_ONEZONE',
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA'|'COMPLETED',
   *   PartsCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|DateString|TimestampSecond
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF'
   * }>
   * ```
   *
   * Retrieves the headers of an object from the AWS S3 Bucket.
   *
   * Arguments:
   *   * `key` - the key of the object inside the bucket. An object key is essentially the path to the object inside a bucket without the leading slash.
   *   * `options`
   *     * `IfMatch` - if the entity tag (ETag) in the response is different than the one specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. For more information, see [If-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1).
   *     * `IfModifiedSince` - if the object has not been modified since the time specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. If the `IfNoneMatch` option is specified, this option is ignored. For more information, see [If-Modified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3).
   *     * `IfNoneMatch` - if the object has the same entity tag (ETag) as the one specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. For more information, see [If-None-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2).
   *     * `IfUnmodifiedSince` - if the object has been modified since the time specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. If the `IfMatch` option is specified, this option is ignored. For more information, see [If-Unmodified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4).
   *     * `Range` - download only the byte range of the object specified by this option. For more information, see [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2).
   *     * `ResponseCacheControl` - sets the [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2) header of the response.
   *     * `ResponseContentDisposition` - sets the [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266) header of the response.
   *     * `ResponseContentEncoding` - sets the [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4) header of the response.
   *     * `ResponseContentLanguage` - sets the [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5) header of the response.
   *     * `ResponseContentType` - sets the [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3) header of the response.
   *     * `ResponseExpires` - sets the [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3) header of the response.
   *     * `VersionId` - the specific version of the object. If the version of the object specified by this option is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html), Amazon S3 responds with HTTP status code `405 Method Not Allowed`. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `PartNumber` - (TODO) part number of the object being read. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumMode` - required to retrieve the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object.
   *
   * Return:
   *   * `data`
   *     * `DeleteMarker` - if `true`, the current version or specified object version is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html).
   *     * `AcceptRanges` - the range of bytes specified by the [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2) header of the request.
   *     * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *     * `Restore` - provides information about the object restoration action and expiration time of the restored object copy. For more information, see [Restoring an archived object](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html) from the _Amazon S3 User Guide_.
   *     * `ArchiveStatus` - archive status of the object.
   *     * `LastModified` - date/time when the object was last modified.
   *     * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *     * `ETag` - the entity tag or MD5 hash of the object.
   *     * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumCRC64NVME` - the base64-encoded, 64-bit CRC-64NVME [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `MissingMeta` - the number of metadata entries not returned in the headers that are prefixed with `x-amz-meta-`. For more information, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *     * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *     * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *     * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *     * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *     * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *     * `ContentRange` - the portion of the object returned in the response. For more information, see [Content-Range](https://datatracker.ietf.org/doc/html/rfc7233#section-4.2)
   *     * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *     * `Expires` - deprecated in favor of `ExpiresString`.
   *     * `ExpiresString` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *     * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *     * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *     * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *     * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *     * `BucketKeyEnabled` - indicates that Amazon S3 used the Amazon S3 Bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *     * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *     * `ReplicationStatus` - (TODO) the progress of replicating objects between buckets. For more information, see [Replicating objects within and across Regions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html).
   *     * `PartsCount` - (TODO) the parts count of the object. This value is only returned if the `PartNumber` option was specified and the object was uploaded as a multipart upload. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *     * `ObjectLockLegalHoldStatus` - indicates the status of the legal hold applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * const data = await myBucket.headObject('my-key')
   * ```
   *
   */
  async headObject(key, options = {}) {
    const headers = {}

    if (options.IfMatch) {
      headers['If-Match'] = options.IfMatch
    }
    if (options.IfModifiedSince) {
      headers['If-Modified-Since'] = options.IfModifiedSince
    }

    if (options.IfNoneMatch) {
      headers['If-None-Match'] = options.IfNoneMatch
    }
    if (options.IfUnmodifiedSince) {
      headers['If-Unmodified-Since'] = options.IfUnmodifiedSince
    }

    if (options.Range) {
      headers['Range'] = options.Range
    }

    if (options.SSECustomerAlgorithm) {
      headers['X-Amz-Server-Side-Encryption-Customer-Algorithm'] =
        options.SSECustomerAlgorithm
    }

    if (options.SSECustomerKey) {
      headers['X-Amz-Server-Side-Encryption-Customer-Key'] =
        options.SSECustomerKey
    }

    if (options.SSECustomerKeyMD5) {
      headers['X-Amz-Server-Side-Encryption-Customer-Key-MD5'] =
        options.SSECustomerKeyMD5
    }

    if (options.ChecksumMode) {
      headers['X-Amz-Checksum-Mode'] = options.ChecksumMode
    }

    const searchParams = new URLSearchParams()

    /* TODO
    if (options.PartNumber) {
      searchParams.set('partNumber', options.PartNumber)
    }
    */

    if (options.ResponseCacheControl) {
      searchParams.set('response-cache-control', options.ResponseCacheControl)
    }

    if (options.ResponseContentDisposition) {
      searchParams.set(
        'response-content-disposition',
        options.ResponseContentDisposition
      )
    }

    if (options.ResponseContentEncoding) {
      searchParams.set(
        'response-content-encoding',
        options.ResponseContentEncoding
      )
    }

    if (options.ResponseContentLanguage) {
      searchParams.set(
        'response-content-language',
        options.ResponseContentLanguage
      )
    }

    if (options.ResponseContentType) {
      searchParams.set('response-content-type', options.ResponseContentType)
    }
    if (options.ResponseExpires) {
      searchParams.set('response-expires', new Date(options.ResponseExpires).toISOString())
    }
    if (options.VersionId) {
      searchParams.set('versionId', options.VersionId)
    }

    const response = await this._awsRequest1(
      'HEAD',
      searchParams.size > 0
        ? `/${key}?${searchParams.toString()}`
        : `/${key}`,
      headers,
      ''
    )

    if (response.ok) {
      const data = {}

      if (response.headers['accept-ranges']) {
        data.AcceptRanges = response.headers['accept-ranges']
      }

      if (response.headers['x-amz-expiration']) {
        data.Expiration = response.headers['x-amz-expiration']
      }
      if (response.headers['x-amz-restore']) {
        data.Restore = response.headers['x-amz-restore']
      }

      if (response.headers['x-amz-archive-status']) {
        data.ArchiveStatus = response.headers['x-amz-archive-status']
      }

      if (response.headers['last-modified']) {
        data.LastModified = response.headers['last-modified']
      }
      if (response.headers['content-length']) {
        data.ContentLength = response.headers['content-length']
      }

      if (response.headers['etag']) {
        data.ETag = response.headers['etag']
      }
      if (response.headers['x-amz-checksum-crc32']) {
        data.ChecksumCRC32 = response.headers['x-amz-checksum-crc32']
      }

      if (response.headers['x-amz-checksum-crc32c']) {
        data.ChecksumCRC32C = response.headers['x-amz-checksum-crc32c']
      }
      if (response.headers['x-amz-checksum-crc64nvme']) {
        data.ChecksumCRC64NVME = response.headers['x-amz-checksum-crc64nvme']
      }

      if (response.headers['x-amz-checksum-sha1']) {
        data.ChecksumSHA1 = response.headers['x-amz-checksum-sha1']
      }
      if (response.headers['x-amz-checksum-sha256']) {
        data.ChecksumSHA256 = response.headers['x-amz-checksum-sha256']
      }

      if (response.headers['x-amz-checksum-type']) {
        data.ChecksumType = response.headers['x-amz-checksum-type']
      }

      if (response.headers['x-amz-missing-meta']) {
        data.MissingMeta = response.headers['x-amz-missing-meta']
      }
      if (response.headers['x-amz-version-id']) {
        data.VersionId = response.headers['x-amz-version-id']
      }

      if (response.headers['cache-control']) {
        data.CacheControl = response.headers['cache-control']
      }
      if (response.headers['content-disposition']) {
        data.ContentDisposition = response.headers['content-disposition']
      }

      if (response.headers['content-encoding']) {
        data.ContentEncoding = response.headers['content-encoding']
      }
      if (response.headers['content-language']) {
        data.ContentLanguage = response.headers['content-language']
      }

      if (response.headers['content-range']) {
        data.ContentRange = response.headers['content-range']
      }
      if (response.headers['content-type']) {
        data.ContentType = response.headers['content-type']
      }
      if (response.headers['expires']) {
        data.Expires = response.headers['expires']
      }

      if (response.headers['x-amz-website-redirect-location']) {
        data.WebsiteRedirectLocation =
          response.headers['x-amz-website-redirect-location']
      }
      if (response.headers['x-amz-server-side-encryption']) {
        data.ServerSideEncryption =
          response.headers['x-amz-server-side-encryption']
      }

      if (response.headers['x-amz-server-side-encryption-customer-algorithm']) {
        data.SSECustomerAlgorithm =
          response.headers['x-amz-server-side-encryption-customer-algorithm']
      }

      if (response.headers['x-amz-server-side-encryption-customer-key-md5']) {
        data.SSECustomerKeyMD5 =
          response.headers['x-amz-server-side-encryption-customer-key-md5']
      }

      if (response.headers['x-amz-server-side-encryption-aws-kms-key-id']) {
        data.SSEKMSKeyId =
          response.headers['x-amz-server-side-encryption-aws-kms-key-id']
      }

      if (response.headers['x-amz-server-side-encryption-bucket-key-enabled']) {
        data.BucketKeyEnabled =
          response.headers['x-amz-server-side-encryption-bucket-key-enabled'] == 'true'
      }

      if (response.headers['x-amz-storage-class']) {
        data.StorageClass = response.headers['x-amz-storage-class']
      }

      /* TODO
      if (response.headers['x-amz-replication-status']) {
        data.ReplicationStatus = response.headers['x-amz-replication-status']
      }
      */

      /* TODO
      if (response.headers['x-amz-mp-parts-count']) {
        data.PartsCount = response.headers['x-amz-mp-parts-count']
      }
      */

      if (response.headers['x-amz-tagging-count']) {
        data.TagCount = response.headers['x-amz-tagging-count']
      }

      if (response.headers['x-amz-object-lock-mode']) {
        data.ObjectLockMode = response.headers['x-amz-object-lock-mode']
      }
      if (response.headers['x-amz-object-lock-retain-until-date']) {
        data.ObjectLockRetainUntilDate =
          response.headers['x-amz-object-lock-retain-until-date']
      }
      if (response.headers['x-amz-object-lock-legal-hold']) {
        data.ObjectLockLegalHoldStatus =
          response.headers['x-amz-object-lock-legal-hold']
      }

      await Readable.Text(response)
      return data
    }

    const errorData = {}
    if (response.headers['x-amz-delete-marker']) {
      errorData.DeleteMarker = response.headers['x-amz-delete-marker'] == 'true'
    }
    throw new AwsError(await Readable.Text(response), response.status, errorData)
  }

  /**
   * @name deleteObject
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteObject(key string, options {
   *   MFA: string,
   *   VersionId: string,
   *   BypassGovernanceRetention: boolean,
   * }) -> data Promise<{
   *   DeleteMarker: boolean,
   *   VersionId: string,
   * }>
   * ```
   *
   * Remove an object from the AWS S3 Bucket.
   *
   * Arguments:
   *   * `key` - the key of the object inside the bucket. An object key is essentially the path to the object inside a bucket without the leading slash.
   *   * `options`
   *     * `MFA` - the concatenation of the authentication device's serial number, a space, and the value displayed on the authentication device. Required to permanently delete a versioned object if versioning is configured with Multifactor Authentication (MFA) delete enabled. For more information, see [Configuring MFA delete](https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiFactorAuthenticationDelete.html) from the _Amazon S3 User Guide_.
   *     * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *     * `BypassGovernanceRetention` - if `true`, S3 Object Lock bypasses [Governance mode](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html#object-lock-retention-modes) restrictions to process this operation. Requires the `s3:BypassGovernanceRetention` permission.
   *
   * Return:
   *   * `data`
   *     * `DeleteMarker` - if `VersionId` was specified and `DeleteMarker` is `true`, the specified object version that was permanently deleted was a delete marker. If `VersionId` was not specified (simple DELETE) and `DeleteMarker` is `true`, the current version of the object is a delete marker. See [Working with delete markers](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) for more information. This field is not present if the AWS S3 Bucket does not support versioning.
   *     * `VersionId` - version ID of the [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) created as a result of the DELETE operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   * })
   *   ...awsCreds,
   * await myBucket.ready
   *
   * await myBucket.deleteObject('my-key')
   * ```
   *
   */
  async deleteObject(key, options = {}) {
    const headers = {}

    /* TODO
    if (options.MFA) {
      headers['X-Amz-MFA'] = options.MFA
    }
    */

    /* TODO
    if (options.BypassGovernanceRetention) {
      headers['X-Amz-Bypass-Governance-Retention'] = options.BypassGovernanceRetention
    }
    */

    const searchParams = new URLSearchParams()

    if (options.VersionId) {
      searchParams.set('versionId', options.VersionId)
    }

    const response = await this._awsRequest1(
      'DELETE',
      searchParams.size > 0
        ? `/${key}?${searchParams.toString()}`
        : `/${key}`,
      headers,
      ''
    )

    if (response.ok) {
      const data = {}

      if (response.headers['x-amz-delete-marker']) {
        data.DeleteMarker = response.headers['x-amz-delete-marker'] == 'true'
      }

      if (response.headers['x-amz-version-id']) {
        data.VersionId = response.headers['x-amz-version-id']
      }

      await Readable.Text(response)
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name deleteObjects
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteObjects(
   *   keys Array<string|{ Key: string, VersionId: string }>,
   *   options {
   *     BypassGovernanceRetention: boolean,
   *   }
   * ) -> data Promise<{
   *   Deleted: Array<{
   *     Key: string,
   *     VersionId: string,
   *     DeleteMarker: boolean,
   *     DeleteMarkerVersionId: string
   *   }>,
   *   Errors: Array<{
   *     Key: string,
   *     VersionId: string,
   *     Code: string
   *   }>
   * }>
   * ```
   *
   * Removes multiple objects from the AWS S3 Bucket.
   *
   * Arguments:
   *   * `keys` - the keys and/or version IDs of the objects or object versions to delete inside the bucket.
   *   * `options`
   *     * `BypassGovernanceRetention` - if `true`, S3 Object Lock bypasses [Governance mode](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html#object-lock-retention-modes) restrictions to process this operation. Requires the `s3:BypassGovernanceRetention` permission.
   *
   * Return:
   *   * `data`
   *     * `Deleted` - container for a successful delete.
   *       * `Key` - the name of a deleted object.
   *       * `VersionId` - the version ID of the deleted object.
   *       * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *       * `DeleteMarkerVersionId` - version ID of the [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) created as a result of the DELETE operation, or if a specific object version was deleted, the version ID of the deleted object version.
   *     * `Errors` - container for a failed delete.
   *       * `Key` - the name of the object of the attempted delete.
   *       * `VersionId` - the version ID of the object of the attempted delete.
   *       * `Code` - a response code that uniquely identifies the error condition. For a complete list of error responses, see [Error responses](https://docs.aws.amazon.com/AmazonS3/latest/API/ErrorResponses.html) from the _Amazon S3 API_.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * await myBucket.deleteObjects(['my-key-1', 'my-key-2'])
   * ```
   */
  async deleteObjects(keys, options = {}) {
    const headers = {}

    /* TODO
    if (options.MFA) {
      headers['X-Amz-MFA'] = options.MFA
    }
    */

    /* TODO
    if (options.BypassGovernanceRetention) {
      headers['X-Amz-Bypass-Governance-Retention'] = options.BypassGovernanceRetention
    }
    */

    const body = `
<?xml version="1.0" encoding="UTF-8"?>
<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${
    keys.map(key => typeof key == 'string' ? `
   <Object>
      <Key>${key}</Key>
   </Object>
    `.trim() : `
   <Object>
      <Key>${key.Key}</Key>
      <VersionId>${key.VersionId}</VersionId>
   </Object>
    `.trim()).join('\n')
  }
</Delete>
    `.trim()

    headers['Content-MD5'] = crypto.createHash('md5').update(body).digest('base64')

    const response = await this._awsRequest1('POST', '/?delete', headers, body)

    if (response.ok) {
      const text = await Readable.Text(response)
      const xmlData = XML.parse(text)

      const data = {}
      data.Deleted = xmlData.DeleteResult.Deleted ?? []
      if (!Array.isArray(data.Deleted)) {
        data.Deleted = [data.Deleted]
      }
      data.Errors = xmlData.DeleteResult.Error ?? []
      if (!Array.isArray(data.Errors)) {
        data.Errors = [data.Errors]
      }

      return data
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name deleteAllObjects
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteAllObjects(options {
   *   BatchSize: number
   *   BypassGovernanceRetention: boolean,
   * }) -> data Promise<{
   *   Deleted: Array<{
   *     Key: string,
   *     VersionId: string,
   *     DeleteMarker: boolean,
   *     DeleteMarkerVersionId: string,
   *   }>,
   *   Errors: Array<{
   *     Key: string,
   *     VersionId: string,
   *     Code: string
   *   }>
   * }>
   * ```
   *
   * Removes all objects from an AWS S3 Bucket.
   *
   * Arguments:
   *   * `options`
   *     * `BatchSize` - the maximum number of objects per batch of objects to delete.
   *     * `BypassGovernanceRetention` - if `true`, S3 Object Lock bypasses [Governance mode](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html#object-lock-retention-modes) restrictions to process this operation. Requires the `s3:BypassGovernanceRetention` permission.
   *
   * Return:
   *   * `data`
   *     * `Deleted` - container for a successful delete.
   *       * `Key` - the name of a deleted object.
   *       * `VersionId` - the version ID of the deleted object.
   *       * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *       * `DeleteMarkerVersionId` - version ID of the [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) created as a result of the DELETE operation, or if a specific object version was deleted, the version ID of the deleted object version.
   *     * `Errors` - container for a failed delete.
   *       * `Key` - the name of the object of the attempted delete.
   *       * `VersionId` - the version ID of the object of the attempted delete.
   *       * `Code` - a response code that uniquely identifies the error condition. For a complete list of error responses, see [Error responses](https://docs.aws.amazon.com/AmazonS3/latest/API/ErrorResponses.html) from the _Amazon S3 API_.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * await myBucket.deleteAllObjects()
   * ```
   */
  async deleteAllObjects(options = {}) {
    const { BatchSize, ...deleteObjectsOptions } = options
    const response = {}
    let contents = await this.listObjects({ MaxKeys: BatchSize }).then(get('Contents'))

    while (contents.length > 0) {
      const response1 = await this.deleteObjects(
        contents.map(get('Key')),
        deleteObjectsOptions
      )
      contents = await this.listObjects({ MaxKeys: BatchSize }).then(get('Contents'))

      if (response1.Deleted) {
        response.Deleted ??= []
        response.Deleted = response.Deleted.concat(response1.Deleted)
      }

      if (response1.Errors.length > 0) {
        const errors = response1.Errors.map(({ Key, VersionId, Code, Message }) => {
          if (VersionId) {
            return new Error(`${Key} (VersionId ${VersionId}): ${Code}: ${Message}`)
          }
          return new Error(`${Key}: ${Code}: ${Message}`)
        })
        throw new AggregateError(errors)
      }

    }

    let versions = await this.listObjectVersions({ MaxKeys: BatchSize }).then(get('Versions'))

    while (versions.length > 0) {
      const response1 = await this.deleteObjects(
        versions.map(pick(['Key', 'VersionId'])),
        deleteObjectsOptions
      )
      versions = await this.listObjectVersions({ MaxKeys: BatchSize }).then(get('Versions'))

      if (response1.Deleted) {
        response.Deleted ??= []
        response.Deleted = response.Deleted.concat(response1.Deleted)
      }

      if (response1.Errors.length > 0) {
        const errors = response1.Errors.map(createS3DeleteObjectError)
        throw new AggregateError(errors)
      }

    }

    let deleteMarkers = await this.listObjectVersions({ MaxKeys: BatchSize }).then(get('DeleteMarkers'))

    while (deleteMarkers.length > 0) {
      const response1 = await this.deleteObjects(
        deleteMarkers.map(pick(['Key', 'VersionId'])),
        deleteObjectsOptions
      )
      deleteMarkers = await this.listObjectVersions({ MaxKeys: BatchSize }).then(get('DeleteMarkers'))

      if (response1.Deleted) {
        response.Deleted ??= []
        response.Deleted = response.Deleted.concat(response1.Deleted)
      }

      if (response1.Errors.length > 0) {
        const errors = response1.Errors.map(createS3DeleteObjectError)
        throw new AggregateError(errors)
      }

    }

    return response
  }

  /**
   * @name listObjects
   *
   * @docs
   * ```coffeescript [specscript]
   * listObjects(options {
   *   Delimiter: string,
   *   EncodingType: 'url',
   *   MaxKeys: number,
   *   Prefix: string,
   *   ContinuationToken: string,
   *   FetchOwner: boolean,
   *   StartAfter: string,
   * }) -> data Promise<{
   *   IsTruncated: boolean,
   *   Contents: Array<{
   *     Key: string,
   *     LastModified: Date,
   *     ETag: string,
   *     ChecksumAlgorithm: 'CRC32'|'CRC32C'|'SHA1'|'SHA256',
   *     Size: number, # bytes
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'
   *                   |'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *                   |'GLACIER_IR'|'SNOW'|'EXPRESS_ONEZONE',
   *     Owner: {
   *       DisplayName: string,
   *       ID: string
   *     },
   *   }>,
   *   CommonPrefixes: Array<{ Prefix: string }>,
   *   KeyCount: number,
   *   NextContinuationToken: string,
   * }>
   * ```
   *
   * Lists some or all (up to 1,000) objects from the AWS S3 Bucket. Objects are returned in [lexicographical order](https://help.splunk.com/en/splunk-cloud-platform/search/spl2-search-manual/sort-and-order/lexicographical-order).
   *
   * Arguments:
   *   * `options`
   *     * `Delimiter` - character used to group keys. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *     * `EncodingType` - encoding type of the [object keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) in the response. If specified as `url`, object keys in the response use [percent-encoding](https://datatracker.ietf.org/doc/html/rfc3986#section-2.1).
   *     * `MaxKeys` - maximum number of keys returned in the response. Defaults to `1000`.
   *     * `Prefix` - limits the response to keys that begin with the specified prefix.
   *     * `ContinuationToken` - indicates to Amazon S3 that the list is being continued on this bucket with a token. Used to paginate list results.
   *     * `FetchOwner` - if `true`, the `Owner` field indicating the owner of the object will be present with each key in the response.
   *     * `StartAfter` - the key after which Amazon S3 will start listing in [lexicographical order](https://help.splunk.com/en/splunk-cloud-platform/search/spl2-search-manual/sort-and-order/lexicographical-order).
   *
   * Return:
   *   * `data`
   *     * `IsTruncated` - set to `true` if there are more keys available in the bucket to retrieve.
   *     * `Contents` - data and metadata about each object returned.
   *       * `Key` - a name or path that uniquely identifies the object. For more information, see [Naming Amazon S3 objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) from the _Amazon S3 User Guide_.
   *       * `LastModified` - creation date of the object.
   *       * `ETag` - the entity tag or MD5 hash of the object.
   *       * `ChecksumAlgorithm`- indicates the algorithm used to create the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *       * `Size` - size or data length in bytes of the object.
   *       * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *       * `Owner` - the owner of the object.
   *         * `DisplayName` - the display name of the owner.
   *         * `ID` - the ID of the owner.
   *     * `CommonPrefixes` - common prefixes of keys returned in place of the actual keys. Used to browse keys hierachically. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *       * `Prefix` - the value for a common prefix.
   *     * `KeyCount` - actual number of keys in the response.
   *     * `NextContinuationToken` - indicates there are more keys available in the bucket to be listed. To continue the list, this value should be used as the `ContinuationToken` for the next list objects request.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * const data1 = await myBucket.listObjects()
   *
   * const data2 = await myBucket.listObjects({
   *   Prefix: 'my-prefix'
   * })
   * ```
   *
   */
  async listObjects(options = {}) {
    const headers = {}

    const searchParams = new URLSearchParams()

    if (options.ContinuationToken) {
      searchParams.set('continuation-token', options.ContinuationToken)
    }

    if (options.Delimiter) {
      searchParams.set('delimiter', options.Delimiter)
    }
    if (options.EncodingType) {
      searchParams.set('encoding-type', options.EncodingType)
    }

    if (options.FetchOwner) {
      searchParams.set('fetch-owner', options.FetchOwner)
    }
    if (options.MaxKeys) {
      searchParams.set('max-keys', options.MaxKeys)
    }

    if (options.Prefix) {
      searchParams.set('prefix', options.Prefix)
    }
    if (options.StartAfter) {
      searchParams.set('start-after', options.StartAfter)
    }

    const response = await this._awsRequest1(
      'GET',
      searchParams.size > 0
        ? `/?list-type=2&${searchParams.toString()}`
        : '/?list-type=2',
      headers,
      ''
    )

    if (response.ok) {
      const text = await Readable.Text(response)
      const xmlData = XML.parse(text)

      const data = {}

      data.Contents = xmlData.ListBucketResult.Contents ?? []
      if (!Array.isArray(data.Contents)) {
        data.Contents = [data.Contents]
      }

      data.IsTruncated =
        xmlData.ListBucketResult.IsTruncated == 'true' ? true : false

      if (xmlData.ListBucketResult.CommonPrefixes) {
        data.CommonPrefixes = xmlData.ListBucketResult.CommonPrefixes
        if (!Array.isArray(data.CommonPrefixes)) {
          data.CommonPrefixes = [data.CommonPrefixes]
        }
      }
      data.KeyCount = xmlData.ListBucketResult.KeyCount
      data.NextContinuationToken = xmlData.ListBucketResult.NextContinuationToken

      return data
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name listObjectVersions
   *
   * @docs
   * ```coffeescript [specscript]
   * listObjectVersions(options {
   *   Delimiter: string,
   *   EncodingType: 'url',
   *   KeyMarker: string,
   *   MaxKeys: number,
   *   Prefix: string,
   *   VersionIdMarker: string,
   * }) -> response Promise<{
   *   IsTruncated: boolean,
   *   Versions: Array<{
   *     IsLatest: boolean,
   *     Key: string,
   *     LastModified: Date,
   *     ETag: string,
   *     ChecksumAlgorithm: 'CRC32'|'CRC32C'|'SHA1'|'SHA256',
   *     ChecksumType: 'COMPOSITE'|'FULL_OBJECT',
   *     Size: number, # bytes
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'
   *                   |'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *                   |'GLACIER_IR'|'SNOW'|'EXPRESS_ONEZONE',
   *     Owner: {
   *       DisplayName: string,
   *       ID: string
   *     },
   *     VersionId: string,
   *   }>,
   *   DeleteMarkers: Array<{
   *     IsLatest: boolean,
   *     Key: string,
   *     LastModified: Date,
   *     Owner: {
   *       DisplayName: string,
   *       ID: string
   *     },
   *     VersionId: string,
   *   }>,
   *   CommonPrefixes: Array<{ Prefix: string }>,
   *   NextKeyMarker: string,
   *   NextVersionIdMarker: string,
   * }>
   * ```
   *
   * Lists some or all (up to 1,000) object versions from the AWS S3 Bucket. Object versions are returned in [lexicographical order](https://help.splunk.com/en/splunk-cloud-platform/search/spl2-search-manual/sort-and-order/lexicographical-order).
   *
   * Arguments:
   *   * `options`
   *     * `Delimiter` - character used to group keys. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *     * `EncodingType` - encoding type of the [object keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) in the response. If specified as `url`, object keys in the response use [percent-encoding](https://datatracker.ietf.org/doc/html/rfc3986#section-2.1).
   *     * `KeyMarker` - key to start with when listing object versions
   *     * `MaxKeys` - maximum number of object versions returned in the response. Defaults to `1000`.
   *     * `Prefix` - limits the response to keys that begin with the specified prefix.
   *     * `VersionIdMarker` - object version id to start with when listing object versions
   *
   * Return:
   *   * `data`
   *     * `IsTruncated` - set to `true` if there are more object versions available in the bucket to retrieve.
   *     * `Versions` - data and metadata about each object version returned.
   *       * `IsLatest` - if `true`, this object version is the latest version of the object. If `false`, this object version is not the latest version of the object.
   *       * `Key` - a name or path that, along with the VersionId uniquely identifies the object version.
   *       * `LastModified` - date and time when the object was last modified.
   *       * `ETag` - the entity tag or MD5 hash of the object.
   *       * `ChecksumType` - checksum type (`'COMPOSITE'` or `'FULL_OBJECT'`) that is used to calcuulate the object version's checksum value.
   *       * `ChecksumAlgorithm`- indicates the algorithm used to create the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *       * `Size` - size or data length in bytes of the object.
   *       * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *       * `Owner` - the owner of the object.
   *         * `DisplayName` - the display name of the owner.
   *         * `ID` - the ID of the owner.
   *       * `VersionId` - Version ID of the object version.
   *     * `DeleteMarkers` - data and metadata about each delete marker returned.
   *       * `IsLatest` - if `true`, this delete marker is the latest version of the object. If `false`, this delete marker is not the latest version of the object.
   *       * `Key` - a name or path that, along with the VersionId, uniquely identifies the delete marker.
   *       * `LastModified` - date and time when the object was last modified.
   *       * `Owner` - the owner of the object.
   *         * `DisplayName` - the display name of the owner.
   *         * `ID` - the ID of the owner.
   *       * `VersionId` - Version ID of the object version.
   *     * `CommonPrefixes` - common prefixes of keys returned in place of the actual keys. Used to browse keys hierachically. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *       * `Prefix` - the value for a common prefix.
   *     * `NextKeyMarker` - the key of the object version at which to start the next page of object versions.
   *     * `NextVersionIdMarker` - the Version ID of the object version at which to start the next page of object versions.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('default')
   * awsCreds.region = 'us-east-1'
   *
   * const myBucket = new S3Bucket({
   *   name: 'my-bucket-name',
   *   ...awsCreds,
   * })
   * await myBucket.ready
   *
   * const data1 = await myBucket.listObjectVersions()
   *
   * const data2 = await myBucket.listObjectVersions({
   *   Prefix: 'my-prefix'
   * })
   * ```
   *
   */
  async listObjectVersions(options = {}) {
    const headers = {}

    const searchParams = new URLSearchParams()

    if (options.Delimiter) {
      searchParams.set('delimiter', options.Delimiter)
    }
    if (options.EncodingType) {
      searchParams.set('encoding-type', options.EncodingType)
    }

    if (options.KeyMarker) {
      searchParams.set('key-marker', options.KeyMarker)
    }
    if (options.MaxKeys) {
      searchParams.set('max-keys', options.MaxKeys)
    }

    if (options.Prefix) {
      searchParams.set('prefix', options.Prefix)
    }
    if (options.VersionIdMarker) {
      searchParams.set('version-id-marker', options.VersionIdMarker)
    }

    const response = await this._awsRequest1(
      'GET',
      searchParams.size > 0
        ? `/?versions&${searchParams.toString()}`
        : '/?versions',
      headers,
      ''
    )

    if (response.ok) {
      const text = await Readable.Text(response)
      const xmlData = XML.parse(text)

      const data = {}

      data.Versions = xmlData.ListVersionsResult.Version ?? []
      if (!Array.isArray(data.Versions)) {
        data.Versions = [data.Versions]
      }

      data.DeleteMarkers = xmlData.ListVersionsResult.DeleteMarker ?? []
      if (!Array.isArray(data.DeleteMarkers)) {
        data.DeleteMarkers = [data.DeleteMarkers]
      }

      data.IsTruncated =
        xmlData.ListVersionsResult.IsTruncated == 'true' ? true : false

      if (xmlData.ListVersionsResult.CommonPrefixes) {
        data.CommonPrefixes = xmlData.ListVersionsResult.CommonPrefixes
        if (!Array.isArray(data.CommonPrefixes)) {
          data.CommonPrefixes = [data.CommonPrefixes]
        }
      }
      data.NextKeyMarker = xmlData.ListVersionsResult.NextKeyMarker
      data.NextVersionIdMarker = xmlData.ListVersionsResult.NextVersionIdMarker

      return data
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }
}

module.exports = S3Bucket
