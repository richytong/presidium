require('rubico/global')
const S3 = require('./internal/S3')

/**
 * @name S3Bucket
 *
 * @docs
 * Presidium S3Bucket client for [Amazon S3](https://aws.amazon.com/s3/).
 *
 * ```coffeescript [specscript]
 * new S3Bucket(options {
 *   name string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> s3Bucket S3Bucket
 *
 * s3Bucket.ready -> Promise<>
 * ```
 *
 * Persist an S3 Bucket. While the `ready` promise is pending, the Presidium S3Bucket client checks if the bucket under the provided name exists, and if not creates a new bucket for the provided name.
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
 * List of methods:
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
 * ## putObject
 * Add an object to the S3 Bucket.
 *
 * ```coffeescript [specscript]
 * type DateString = string # Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
 * type TimestampSeconds = number # 1751111429
 *
 * s3Bucket.putObject(
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
 *     ExpectedBucketOwner: string, # aws account id '123456789000'
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
 */
class S3Bucket {
  constructor(options) {
    this.name = options.name

    this.s3 = new S3({
      ...pick(options, [
        'accessKeyId',
        'secretAccessKey',
        'endpoint',
      ]),
      region: options.region ?? 'default-region',
    })

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
   * @synopsis
   * ```coffeescript [specscript]
   * type DateString = string # Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
   * type TimestampSeconds = number # 1751111429
   *
   * putObject(
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
   *     ExpectedBucketOwner: string, # aws account id '123456789000'
   *   },
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
   *   RequestCharged: 'requester',
   * }>
   * ```
   */
  putObject(key, body, options) {
    return this.s3.putObject(this.name, key, body, options)
  }

  /**
   * @name upload
   *
   * @synopsis
   * ```coffeescript [specscript]
   * upload(
   *   key string,
   *   body string|Buffer|ReadableStream,
   *   options {
   *     ACL: 'private'|'public-read'|'public-read-write'|'authenticated-read'|'aws-exec-read'|'bucket-owner-read'|'bucket-owner-full-control'
   *     CacheControl: string,
   *     ContentDisposition: string,
   *     ContentEncoding: string,
   *     ContentLanguage: string,
   *     ContentLength: string,
   *     ContentMD5: string,
   *     ContentType: string,
   *     ExpectedBucketOwner: string,
   *     Expires: Date|Date.toString()|number,
   *     GrantFullControl: string,
   *     GrantRead: string,
   *     GrantReadACP: string,
   *     GrantWriteACP: string,
   *     Metadata: Object<string>,
   *     ObjectLockLegalHoldStatus: 'ON'|'OFF',
   *     ObjectLockMode: 'GOVERNANCE'|'COMPLIANCE',
   *     ObjectLockRetainUntilDate: Date|Date.toString()|number,
   *     RequestPayer: requester,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: string|Buffer,
   *     SSECustomerKeyMD5: string,
   *     SSEKMSEncryptionContext: string,
   *     SSEKMSKeyId: string,
   *     ServerSideEncryption: 'AES256'|'aws:kms',
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
   *     Tagging: string,
   *     WebsiteRedirectLocation: string,
   *   },
   * ) -> Promise<{
   *   ETag: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms',
   *   VersionId: string,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKey: string,
   *   SSEKMSKeyId: string,
   *   SSEKMSEncryptionContext: string,
   *   RequestCharged: string,
   * }>
   * ```
   */
  upload(key, body, options) {
    return this.s3.upload(this.name, key, body, options)
  }

  /**
   * @name deleteObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteObject(key string, options {
   *   BypassGovernanceRetention: boolean,
   *   ExpectedBucketOwner: string,
   *   MFA: string,
   *   RequestPayer: requester,
   *   VersionId: string,
   * }) -> Promise
   * ```
   */
  deleteObject(key, options) {
    return this.s3.deleteObject(this.name, key, options)
  }

  /**
   * @name deleteObjects
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteObjects(keys Array<string>, options {
   *   Quiet: boolean,
   *   BypassGovernanceRetention: boolean,
   *   ExpectedBucketOwner: string,
   *   MFA: string,
   *   RequestPayer: requester,
   * }) -> Promise<{
   *   Deleted: Array<{
   *     DeleteMarker: boolean,
   *     DeleteMarkerVersionId: string,
   *     Key: string,
   *   }>,
   *   RequestCharged: string,
   *   Errors: Array<{
   *     Key: string,
   *     VersionId: string,
   *     Code: string,
   *   }>,
   * }>
   * ```
   */
  deleteObjects(keys, options) {
    return this.s3.deleteObjects(this.name, keys, options)
  }

  /**
   * @name deleteAllObjects
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteAllObjects(options {
   *   MaxKeys: number, // batch size
   * }) -> Promise<number>
   * ```
   */
  async deleteAllObjects(options = {}) {
    const { MaxKeys } = options
    let contents = await this.listObjects({ MaxKeys }).then(get('Contents'))
    let numDeleted = contents.length
    while (contents.length > 0) {
      await this.deleteObjects(contents.map(get('Key')))
      numDeleted += contents.length
      contents = await this.listObjects({ MaxKeys }).then(get('Contents'))
    }
    return numDeleted
  }

  /**
   * @name delete
   *
   * @synopsis
   * ```coffeescript [specscript]
   * delete() -> Promise<>
   * ```
   */
  delete() {
    return this.s3.deleteBucket(this.name)
  }

  /**
   * @name getObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getObject(
   *   key string,
   *   options {
   *     ExpectedBucketOwner: string,
   *     IfMatch: string,
   *     IfModifiedSince: Date|Date.toString()|number,
   *     IfNoneMatch: string,
   *     IfUnmodifiedSince: Date|Date.toString()|number,
   *     PartNumber: number,
   *     Range: string,
   *     RequestPayer: requester,
   *     ResponseCacheControl: string,
   *     ResponseContentDisposition: string,
   *     ResponseContentEncoding: string,
   *     ResponseContentLanguage: string,
   *     ResponseContentType: string,
   *     ResponseExpires: Date|Date.toString()|number,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: string|Buffer,
   *     SSECustomerKeyMD5: string,
   *     VersionId: string,
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
   *   MissingMeta: number,
   *   VersionId: string,
   *   CacheControl: string,
   *   ContentDisposition: string,
   *   ContentEncoding: string,
   *   ContentRange: string,
   *   ContentType: string,
   *   Expires: Date,
   *   WebsiteRedirectLocation: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms',
   *   Metadata: Object<string>,
   *   Range: string, // 'bytes=0-9'
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKey: string,
   *   SSEKMSKeyId: string,
   *   StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS',
   *   RequestCharged: string,
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *   PartsCount: number,
   *   TagCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|Date.toString()|number,
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF',
   * }>
   * ```
   */
  getObject(key, options) {
    return this.s3.getObject(this.name, key, options)
  }

  /**
   * @name headObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * headObject(
   *   key string,
   *   options {
   *     ExpectedBucketOwner: string,
   *     IfMatch: string,
   *     IfModifiedSince: Date|Date.toString()|number,
   *     IfNoneMatch: string,
   *     IfUnmodifiedSince: Date|Date.toString()|number,
   *     PartNumber: number,
   *     Range: string,
   *     RequestPayer: requester,
   *     ResponseCacheControl: string,
   *     ResponseContentDisposition: string,
   *     ResponseContentEncoding: string,
   *     ResponseContentLanguage: string,
   *     ResponseContentType: string,
   *     ResponseExpires: Date|Date.toString()|number,
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: string|Buffer,
   *     SSECustomerKeyMD5: string,
   *     VersionId: string,
   *   },
   * ) -> Promise<{
   *   DeleteMarker: boolean,
   *   AcceptRanges: string,
   *   Expiration: string,
   *   Restore: string,
   *   LastModified: Date,
   *   ContentLength: number,
   *   ETag: string,
   *   MissingMeta: number,
   *   VersionId: string,
   *   CacheControl: string,
   *   ContentDisposition: string,
   *   ContentEncoding: string,
   *   ContentRange: string,
   *   ContentType: string,
   *   Expires: Date,
   *   WebsiteRedirectLocation: string,
   *   ServerSideEncryption: 'AES256'|'aws:kms',
   *   Metadata: Object<string>,
   *   Range: string, // 'bytes=0-9'
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKey: string,
   *   SSEKMSKeyId: string,
   *   StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS',
   *   RequestCharged: string,
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *   PartsCount: number,
   *   TagCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|Date.toString()|number,
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF',
   * }>
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
   *   Range: string,
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
   *     MissingMeta: number,
   *     VersionId: string,
   *     CacheControl: string,
   *     ContentDisposition: string,
   *     ContentEncoding: string,
   *     ContentRange: string,
   *     ContentType: string,
   *     Expires: Date,
   *     WebsiteRedirectLocation: string,
   *     ServerSideEncryption: 'AES256'|'aws:kms',
   *     Metadata: Object<string>,
   *     Range: string, // 'bytes=0-9'
   *     SSECustomerAlgorithm: string,
   *     SSECustomerKey: string,
   *     SSEKMSKeyId: string,
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS',
   *     RequestCharged: string,
   *     ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *     PartsCount: number,
   *     TagCount: number,
   *     ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *     ObjectLockRetainUntilDate: Date|Date.toString()|number,
   *     ObjectLockLegalHoldStatus: 'ON'|'OFF',
   *   },
   * }
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
   *   Prefix: string,
   *   ContinuationToken: string,
   *   Delimiter: string,
   *   EncodingType: 'url',
   *   ExpectedBucketOwner: string,
   *   FetchOwner: boolean,
   *   MaxKeys: number,
   *   RequestPayer: requester,
   *   StartAfter: string,
   * }) -> Promise<{
   *   isTruncated: boolean,
   *   Contents: Array<{
   *     Key: string,
   *     LastModified: Date,
   *     ETag: string, // hash of the object
   *     Size: number, // bytes
   *     StorageClass: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS',
   *     Owner: {
   *       DisplayName: string,
   *       ID: string,
   *     },
   *   }>,
   *   Name: string, // bucketname
   *   Prefix: string,
   *   Delimiter: string,
   *   MaxKeys: number,
   *   CommonPrefixes: Array,
   *   EncodingType: 'url',
   *   KeyCount: number,
   *   ContinuationToken: string,
   *   NextContinuationToken: string,
   *   StartAfter: string,
   * }>
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
