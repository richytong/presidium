require('rubico/global')
const S3 = require('./internal/S3')

/**
 * @name S3Bucket
 *
 * @docs
 * Presidium S3Bucket client for [Amazon S3](https://aws.amazon.com/s3/). Creates a new S3 bucket under `name` if a bucket does not already exist. Access to the newly creaed S3 bucket is private.
 *
 * ```coffeescript [specscript]
 * new S3Bucket(options {
 *   name string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> bucket S3Bucket
 * ```
 *
 * ```javascript
 * const S3Bucket = require('presidium/S3Bucket')
 *
 * const awsCreds = {
 *   accessKeyId: 'my-access-key-id',
 *   secretAccessKey: 'my-secret-access-key',
 *   region: 'my-region'
 * }
 *
 * const myBucket = new S3Bucket({
 *   name: 'my-bucket-name',
 *   ...awsCreds,
 * })
 * await myBucket.ready
 * // myBucket is operational
 * ```
 *
 * Options:
 *   * `name` - globally unique name of the S3 Bucket.
 *   * `accessKeyId` - long term credential (ID) of an [IAM](https://aws.amazon.com/iam/) user.
 *   * `secretAccessKey` - long term credential (secret) of an [IAM](https://aws.amazon.com/iam/) user.
 *   * `region` - geographic location of data center cluster, e.g. `us-east-1` or `us-west-2`. [Full list of AWS regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html#available-regions)
 *
 * Methods:
 *   * [putObject](#putobject)
 *   * [upload](#upload)
 *   * [deleteObject](#deleteobject)
 *   * [deleteObjects](#deleteobjects)
 *   * [deleteAllObjects](#deleteallobjects)
 *   * [delete](#delete)
 *   * [getObject](#getobject)
 *   * [headObject](#headobject)
 *   * [getObjectStream](#getobjectstream)
 *   * [listObjects](#listobjects)
 *
 * Attributes:
 *   * [ready](#ready)
 */
class S3Bucket {
  constructor(options) {
    this.name = options.name

    const awsCreds = {
      ...pick(options, [
        'accessKeyId',
        'secretAccessKey',
        'endpoint'
      ]),
      region: options.region ?? 'default-region',
    }

    this.s3 = new S3({ ...awsCreds })

    this.ready = this.s3.getBucketLocation(this.name).then(() => {
      return { message: 'bucket-exists' }
    }).catch(async error => {
      if (error.name == 'NoSuchBucket') {
        await this.s3.createBucket(this.name).catch(() => {})
        return { message: 'created-bucket' }
      } else {
        throw error
      }
    })
  }

  /**
   * @name putObject
   *
   * @docs
   * Add an object to the S3 Bucket.
   *
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
   *     RequestPayer: string,
   *     Tagging: string, # key1=value1&key2=value2
   *     ObjectLockMode: 'GOVERNANCE'|'COMPLIANCE',
   *     ObjectLockRetainUntilDate: Date|DateString|TimestampSeconds,
   *     ObjectLockLegalHoldStatus: 'ON'|'OFF',
   *     ExpectedBucketOwner: string # aws account id '123456789000'
   *   }
   * ) -> response Promise<{
   *   Expiration: string,
   *   ETag: string,
   *   ChecksumCRC32: string,
   *   ChecksumCRC32C: string,
   *   ChecksumSHA1: string,
   *   ChecksumSHA256: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *   VersionId: string,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKeyMD5: string,
   *   SSEKMSKeyId: string,
   *   SSEKMSEncryptionContext: string,
   *   BucketKeyEnabled: boolean,
   *   RequestCharged: 'requester'
   * }>
   * ```
   *
   * ```javascript
   * await myBucket.putObject('some-key', '{"hello":"world"}', {
   *   ContentType: 'application/json',
   * })
   * ```
   *
   * Options:
   *   * `ACL` - the [canned access control list (ACL)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html#canned-acl) to apply to the object. For more information, see [Access control list (ACL) overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html).
   *   * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *   * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *   * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *   * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *   * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *   * `ContentMD5` - the base64-encoded 128-bit MD5 digest of the object. For more information, see [RFC 1864](https://datatracker.ietf.org/doc/html/rfc1864).
   *   * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *   * `ChecksumAlgorithm`- indicates the algorithm used to create the checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html).
   *   * `ChecksumCRC32` - specifies the base64-encoded, 32-bit CRC-32 checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html).
   *   * `ChecksumCRC32C` - specifies the base64-encoded, 32-bit CRC-32C checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html).
   *   * `ChecksumSHA1` - specifies the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html).
   *   * `ChecksumSHA256` - specifies the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html).
   *   * `Expires` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `IfNoneMatch` - uploads the object only if the object key name does not already exist in the bucket. Otherwise, Amazon S3 responds with `412 Precondition Failed`. If a conflicting operation occurs during the upload, Amazon S3 responds with `409 ConditionalRequestConflict`. For more information, see [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232) and [Add preconditions to S3 operations with conditional requests](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html).
   *   * `GrantFullControl`
   *   * `GrantRead`
   *   * `GrantReadACP`
   *   * `GrantWriteACP`
   *   * `Metadata`
   *   * `ServerSideEncryption`
   *   * `StorageClass`
   *   * `WebsiteRedirectLocation`
   *   * `SSECustomerAlgorithm`
   *   * `SSECustomerKey`
   *   * `SSECustomerKeyMD5`
   *   * `SSEKMSKeyId`
   *   * `SSEKMSEncryptionContext`
   *   * `BucketKeyEnabled`
   *   * `RequestPayer`
   *   * `Tagging`
   *   * `ObjectLockMode`
   *   * `ObjectLockRetainUntilDate`
   *   * `ObjectLockLegalHoldStatus`
   *   * `ExpectedBucketOwner`
   */
  putObject(key, body, options) {
    return this.s3.putObject(this.name, key, body, options)
  }

  /**
   * @name upload
   *
   * @docs
   * Upload an object to the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * type DateString = string # Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
   * type TimestampSeconds = number # 1751111429
   *
   * bucket.upload(
   *   key string,
   *   body string|Buffer|ReadableStream,
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
   *     RequestPayer: string,
   *     Tagging: string, # key1=value1&key2=value2
   *     ObjectLockMode: 'GOVERNANCE'|'COMPLIANCE',
   *     ObjectLockRetainUntilDate: Date|DateString|TimestampSeconds,
   *     ObjectLockLegalHoldStatus: 'ON'|'OFF',
   *     ExpectedBucketOwner: string, # aws account id '123456789000'
   *   },
   * ) -> Promise<{
   *   Expiration: string,
   *   ETag: string,
   *   ChecksumCRC32: string,
   *   ChecksumCRC32C: string,
   *   ChecksumSHA1: string,
   *   ChecksumSHA256: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *   VersionId: string,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKeyMD5: string,
   *   SSEKMSKeyId: string,
   *   SSEKMSEncryptionContext: string,
   *   BucketKeyEnabled: boolean,
   *   RequestCharged: 'requester'
   * }>
   * ```
   *
   * ```javascript
   * const fs = require('fs')
   *
   * const myFileReadStream = fs.createReadStream('/path/to/my-file.wav')
   *
   * await myBucket.upload('my-file-key', myFileReadStream, {
   *   ContentType: 'audio/x-wav',
   * })
   * ```
   */
  upload(key, body, options) {
    return this.s3.upload(this.name, key, body, options)
  }

  /**
   * @name deleteObject
   *
   * @docs
   * Remove an object from the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * bucket.deleteObject(key string, options {
   *   MFA: string,
   *   VersionId: string,
   *   RequestPayer: requester,
   *   BypassGovernanceRetention: boolean,
   *   ExpectedBucketOwner: string,
   * }) -> Promise
   * ```
   *
   * ```javascript
   * await myBucket.deleteObject('my-key')
   * ```
   */
  deleteObject(key, options) {
    return this.s3.deleteObject(this.name, key, options)
  }

  /**
   * @name deleteObjects
   *
   * @docs
   * Remove multiple objects from the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * bucket.deleteObjects(
   *   keys Array<string|{ Key: string, VersionId: string }>,
   *   options {
   *     Quiet: boolean,
   *     BypassGovernanceRetention: boolean,
   *     ExpectedBucketOwner: string,
   *     MFA: string,
   *     RequestPayer: requester,
   *   }
   * ) -> Promise<{
   *   Deleted: Array<{
   *     DeleteMarker: boolean,
   *     DeleteMarkerVersionId: string,
   *     Key: string,
   *   }>,
   *   RequestCharged: 'requester',
   *   Errors: Array<{
   *     Key: string,
   *     VersionId: string,
   *     Code: string,
   *   }>,
   * }>
   * ```
   *
   * ```javascript
   * await myBucket.deleteObjects(['my-key-1', 'my-key-2'])
   * ```
   */
  deleteObjects(keys, options) {
    return this.s3.deleteObjects(this.name, keys, options)
  }

  /**
   * @name deleteAllObjects
   *
   * @docs
   * Remove all objects from an S3 Bucket.
   *
   * ```coffeescript [specscript]
   * bucket.deleteAllObjects(options {
   *   BatchSize: number, // batch size
   * }) -> Promise<number>
   * ```
   *
   * ```javascript
   * await myBucket.deleteAllObjects()
   * ```
   */
  async deleteAllObjects(options = {}) {
    const { BatchSize } = options
    let contents = await this.listObjects({ MaxKeys: BatchSize }).then(get('Contents'))
    let numDeleted = contents.length
    while (contents.length > 0) {
      await this.deleteObjects(contents.map(get('Key')))
      numDeleted += contents.length
      contents = await this.listObjects({ MaxKeys: BatchSize }).then(get('Contents'))
    }
    return numDeleted
  }

  /**
   * @name delete
   *
   * @docs
   * Delete the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * bucket.delete() -> Promise<>
   * ```
   *
   * ```javascript
   * await myBucket.delete()
   * ```
   */
  delete() {
    return this.s3.deleteBucket(this.name)
  }

  /**
   * @name getObject
   *
   * @docs
   * Retrieve an object from the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * type DateString = string # Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
   * type TimestampSeconds = number # 1751111429
   *
   * bucket.getObject(
   *   key string,
   *   options {
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
   *     RequestPayer: requester,
   *     PartNumber: number,
   *     ExpectedBucketOwner: string,
   *     ChecksumMode: 'ENABLED',
   *   },
   * ) -> Promise<{
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
   *   RequestCharged: 'requester',
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *   PartsCount: number,
   *   TagCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|DateString|TimestampSeconds,
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF'
   * }>
   * ```
   *
   * ```javascript
   * await myBucket.getObject('my-key')
   * ```
   */
  getObject(key, options) {
    return this.s3.getObject(this.name, key, options)
  }

  /**
   * @name headObject
   *
   * @docs
   * Retrieve the headers of an object from the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * bucket.headObject(
   *   key string,
   *   options {
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
   *     RequestPayer: requester,
   *     PartNumber: number,
   *     ExpectedBucketOwner: string,
   *     ChecksumMode: 'ENABLED',
   *   },
   * ) -> Promise<{
   *   DeleteMarker: boolean,
   *   AcceptRanges: string,
   *   Expiration: string,
   *   Restore: string,
   *   LastModified: Date,
   *   ContentLength: number,
   *   ETag: string,
   *   ChecksumCRC32: string,
   *   ChecksumCRC32C: string,
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
   *   RequestCharged: 'requester',
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *   PartsCount: number,
   *   TagCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|DateString|TimestampSecond
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF'
   * }>
   * ```
   *
   * ```javascript
   * const response = await myBucket.headObject('my-key')
   * ```
   */
  headObject(key, options) {
    return this.s3.headObject(this.name, key, options)
  }

  /**
   * @name getObjectStream
   *
   * @synopsis
   * ```coffeescript [specscript]
   * module stream
   *
   * getObjectStream(key string, options {
   *   ExpectedBucketOwner: string,
   *   IfMatch: string,
   *   IfModifiedSince: Date|Date.toString()|number,
   *   IfNoneMatch: string,
   *   IfUnmodifiedSince: Date|Date.toString()|number,
   *   PartNumber: number,
   *   Range: string, // 'bytes=0-9'
   *   RequestPayer: requester,
   *   ResponseCacheControl: string,
   *   ResponseContentDisposition: string,
   *   ResponseContentEncoding: string,
   *   ResponseContentLanguage: string,
   *   ResponseContentType: string,
   *   ResponseExpires: Date|Date.toString()|number,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKey: string|Buffer,
   *   SSECustomerKeyMD5: string,
   *   VersionId: string,
   * }) -> rs stream.Readable {
   *   headers: {
   *     DeleteMarker: boolean,
   *     AcceptRanges: string,
   *     Expiration: string,
   *     Restore: string,
   *     LastModified: Date,
   *     ContentLength: number,
   *     ETag: string,
   *     ChecksumCRC32: string,
   *     ChecksumCRC32C: string,
   *     ChecksumSHA1: string,
   *     ChecksumSHA256: string,
   *     MissingMeta: number,
   *     VersionId: string,
   *     CacheControl: string,
   *     ContentDisposition: string,
   *     ContentEncoding: string,
   *     ContentLanguage: string,
   *     ContentRange: string,
   *     ContentType: string,
   *     Expires: Date,
   *     ExpiresString: string,
   *     WebsiteRedirectLocation: string,
   *     ServerSideEncryption: 'AES256'|'aws:kms'|'aws:kms:dsse',
   *     Metadata: Object<string>,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKeyMD5: string,
   *     SSEKMSKeyId: string,
   *     BucketKeyEnabled: boolean,
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'
   *                   |'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *                   |'GLACIER_IR'|'SNOW'|'EXPRESS_ONEZONE',
   *     RequestCharged: 'requester',
   *     ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *     PartsCount: number,
   *     TagCount: number,
   *     ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *     ObjectLockRetainUntilDate: Date|DateString|TimestampSeconds,
   *     ObjectLockLegalHoldStatus: 'ON'|'OFF'
   *   }
   * }
   * ```
   *
   * ```javascript
   * const myObjectStream = await myBucket.getObjectStream('my-file-key', {
   *   Range: 'bytes=0-1000000',
   * })
   *
   * myObjectStream.on('data', chunk => {
   *   response.write(chunk)
   * })
   * myObjectStream.on('close', () => {
   *   response.end()
   * })
   * myObjectStream.on('error', error => {
   *   console.error(error)
   *   response.end()
   * })
   * ```
   */
  getObjectStream(key, options) {
    return this.s3.getObjectStream(this.name, key, options)
  }

  /**
   * @name listObjects
   *
   * @synopsis
   * ```coffeescript [specscript]
   * listObjects(options {
   *   Delimiter: string,
   *   EncodingType: 'url',
   *   MaxKeys: number,
   *   Prefix: string,
   *   ContinuationToken: string,
   *   FetchOwner: boolean,
   *   StartAfter: string,
   *   RequestPayer: requester,
   *   ExpectedBucketOwner: string,
   *   OptionalObjectAttributes: Array<string>
   * }) -> Promise<{
   *   isTruncated: boolean,
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
   *     RestoreStatus: {
   *       IsRestoreInProgress: boolean,
   *       RestoreExpiryDate: Date|DateString|TimestampSeconds
   *     }
   *   }>,
   *   Name: string,
   *   Prefix: string,
   *   Delimiter: string,
   *   MaxKeys: number,
   *   CommonPrefixes: Array<{ Prefix: string }>,
   *   EncodingType: 'url',
   *   KeyCount: number,
   *   ContinuationToken: string,
   *   NextContinuationToken: string,
   *   StartAfter: string,
   *   RequestCharged: 'requester'
   * }>
   * ```
   *
   * ```javascript
   * const response = await myBucket.listObjects()
   *
   * const response = await myBucket.listObjects({
   *   Prefix: 'my-prefix'
   * })
   * ```
   */
  listObjects(options) {
    return this.s3.listObjectsV2(this.name, options).catch(error => {
      if (error.retryable) {
        return this.listObjects(options)
      }
      throw error
    })
  }
}

module.exports = S3Bucket
