require('rubico/global')
const S3 = require('./S3')

/**
 * @name S3Bucket
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options {
 *   name string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 *   signatureVersion: string, // 'v2'
 * })
 * ```
 */
const S3Bucket = function (options) {
  if (this == null || this.constructor != S3Bucket) {
    return new S3Bucket(options)
  }
  this.name = options.name
  this.s3 = new S3(pick([
    'accessKeyId',
    'secretAccessKey',
    'region',
    'endpoint',
    'signatureVersion',
  ])(options))
  this.ready = this.s3.getBucketLocation(this.name).catch(async error => {
    if (error.name == 'NoSuchBucket') {
      await this.s3.createBucket(this.name) // TODO handle create options here
    } else {
      throw error
    }
  })
  return this
}

/**
 * @name S3Bucket.prototype.putObject
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).putObject(
 *   key string,
 *   body string|Buffer|ReadableStream,
 *   options? {
 *     ACL: 'private'|'public-read'|'public-read-write'|'authenticated-read'|'aws-exec-read'|'bucket-owner-read'|'bucket-owner-full-control'
 *     CacheControl?: string,
 *     ContentDisposition?: string,
 *     ContentEncoding?: string,
 *     ContentLanguage?: string,
 *     ContentLength?: string,
 *     ContentMD5?: string,
 *     ContentType?: string,
 *     ExpectedBucketOwner?: string,
 *     Expires?: Date|Date.toString()|number,
 *     GrantFullControl?: string,
 *     GrantRead?: string,
 *     GrantReadACP?: string,
 *     GrantWriteACP?: string,
 *     Metadata?: Object<string>,
 *     ObjectLockLegalHoldStatus?: 'ON'|'OFF',
 *     ObjectLockMode?: 'GOVERNANCE'|'COMPLIANCE',
 *     ObjectLockRetainUntilDate?: Date|Date.toString()|number,
 *     RequestPayer?: requester,
 *     SSECustomerAlgorithm?: string,
 *     SSECustomerKey?: string|Buffer,
 *     SSECustomerKeyMD5?: string,
 *     SSEKMSEncryptionContext?: string,
 *     SSEKMSKeyId?: string,
 *     ServerSideEncryption?: 'AES256'|'aws:kms',
 *     StorageClass?: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
 *     Tagging?: string,
 *     WebsiteRedirectLocation?: string,
 *   },
 * ) -> Promise<{
 *   ETag: string,
 *   ServerSideEncryption?: 'AES256'|'aws:kms',
 *   VersionId: string,
 *   SSECustomerAlgorithm?: string,
 *   SSECustomerKey?: string,
 *   SSEKMSKeyId?: string,
 *   SSEKMSEncryptionContext?: string,
 *   RequestCharged?: string,
 * }>
 * ```
 */
S3Bucket.prototype.putObject = async function s3BucketPutObject(
  key, body, options,
) {
  await this.ready
  return this.s3.putObject(this.name, key, body, options)
}

/**
 * @name S3Bucket.prototype.upload
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).upload(
 *   key string,
 *   body string|Buffer|ReadableStream,
 *   options? {
 *     ACL: 'private'|'public-read'|'public-read-write'|'authenticated-read'|'aws-exec-read'|'bucket-owner-read'|'bucket-owner-full-control'
 *     CacheControl?: string,
 *     ContentDisposition?: string,
 *     ContentEncoding?: string,
 *     ContentLanguage?: string,
 *     ContentLength?: string,
 *     ContentMD5?: string,
 *     ContentType?: string,
 *     ExpectedBucketOwner?: string,
 *     Expires?: Date|Date.toString()|number,
 *     GrantFullControl?: string,
 *     GrantRead?: string,
 *     GrantReadACP?: string,
 *     GrantWriteACP?: string,
 *     Metadata?: Object<string>,
 *     ObjectLockLegalHoldStatus?: 'ON'|'OFF',
 *     ObjectLockMode?: 'GOVERNANCE'|'COMPLIANCE',
 *     ObjectLockRetainUntilDate?: Date|Date.toString()|number,
 *     RequestPayer?: requester,
 *     SSECustomerAlgorithm?: string,
 *     SSECustomerKey?: string|Buffer,
 *     SSECustomerKeyMD5?: string,
 *     SSEKMSEncryptionContext?: string,
 *     SSEKMSKeyId?: string,
 *     ServerSideEncryption?: 'AES256'|'aws:kms',
 *     StorageClass?: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS'
 *     Tagging?: string,
 *     WebsiteRedirectLocation?: string,
 *   },
 * ) -> Promise<{
 *   ETag: string,
 *   ServerSideEncryption?: 'AES256'|'aws:kms',
 *   VersionId: string,
 *   SSECustomerAlgorithm?: string,
 *   SSECustomerKey?: string,
 *   SSEKMSKeyId?: string,
 *   SSEKMSEncryptionContext?: string,
 *   RequestCharged?: string,
 * }>
 * ```
 */
S3Bucket.prototype.upload = async function upload(key, body, options) {
  await this.ready
  return this.s3.upload(this.name, key, body, options)
}


/**
 * @name S3Bucket.prototype.deleteObject
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).deleteObject(key string, options? {
 *   BypassGovernanceRetention?: boolean,
 *   ExpectedBucketOwner?: string,
 *   MFA?: string,
 *   RequestPayer?: requester,
 *   VersionId?: string,
 * }) -> Promise
 * ```
 */
S3Bucket.prototype.deleteObject = async function s3BucketDeleteObject(
  key, options,
) {
  await this.ready
  return this.s3.deleteObject(this.name, key, options)
}

/**
 * @name S3Bucket.prototype.deleteObjects
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).deleteObjects(keys Array<string>, options? {
 *   Quiet?: boolean,
 *   BypassGovernanceRetention?: boolean,
 *   ExpectedBucketOwner?: string,
 *   MFA?: string,
 *   RequestPayer?: requester,
 * }) -> Promise<{
 *   Deleted: Array<{
 *     DeleteMarker: boolean,
 *     DeleteMarkerVersionId: string,
 *     Key: string,
 *   }>,
 *   RequestCharged?: string,
 *   Errors?: Array<{
 *     Key: string,
 *     VersionId: string,
 *     Code: string,
 *   }>,
 * }>
 * ```
 */
S3Bucket.prototype.deleteObjects = async function s3BucketDeleteObjects(
  keys, options,
) {
  await this.ready
  return this.s3.deleteObjects(this.name, keys, options)
}

/**
 * @name S3Bucket.prototype.deleteAllObjects
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(options).deleteAllObjects(opts {
 *   MaxKeys: number, // batch size
 * }) -> Promise<>
 * ```
 */
S3Bucket.prototype.deleteAllObjects = async function s3BucketDeleteAllObjects(
  options,
) {
  const opts = pick(['MaxKeys'])(options)
  let contents = await this.listObjects(opts).then(get('Contents'))
  while (contents.length > 0) {
    await this.deleteObjects(contents.map(get('Key')))
    contents = await this.listObjects(opts).then(get('Contents'))
  }
}

/**
 * @name S3Bucket.prototype.delete
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(options).delete() -> Promise<>
 * ```
 */
S3Bucket.prototype.delete = async function s3BucketDelete() {
  return this.s3.deleteBucket(this.name)
}

/**
 * @name S3Bucket.prototype.getObject
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).getObject(
 *   key string,
 *   options? {
 *     ExpectedBucketOwner?: string,
 *     IfMatch?: string,
 *     IfModifiedSince?: Date|Date.toString()|number,
 *     IfNoneMatch?: string,
 *     IfUnmodifiedSince?: Date|Date.toString()|number,
 *     PartNumber?: number,
 *     Range?: string,
 *     RequestPayer?: requester,
 *     ResponseCacheControl?: string,
 *     ResponseContentDisposition?: string,
 *     ResponseContentEncoding?: string,
 *     ResponseContentLanguage?: string,
 *     ResponseContentType?: string,
 *     ResponseExpires?: Date|Date.toString()|number,
 *     SSECustomerAlgorithm?: string,
 *     SSECustomerKey?: string|Buffer,
 *     SSECustomerKeyMD5?: string,
 *     VersionId?: string,
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
 *   ServerSideEncryption?: 'AES256'|'aws:kms',
 *   Metadata?: Object<string>,
 *   SSECustomerAlgorithm?: string,
 *   SSECustomerKey?: string,
 *   SSEKMSKeyId?: string,
 *   StorageClass?: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS',
 *   RequestCharged?: string,
 *   ReplicationStatus?: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
 *   PartsCount: number,
 *   TagCount: number,
 *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
 *   ObjectLockRetainUntilDate?: Date|Date.toString()|number,
 *   ObjectLockLegalHoldStatus?: 'ON'|'OFF',
 * }>
 * ```
 */
S3Bucket.prototype.getObject = async function sBucketGetObject(key, options) {
  await this.ready
  return this.s3.getObject(this.name, key, options)
}

/**
 * @name S3Bucket.prototype.listObjects
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).listObjects(options? {
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
S3Bucket.prototype.listObjects = async function s3BucketListObjectsV2(options) {
  await this.ready
  return this.s3.listObjectsV2(this.name, options)
}

module.exports = S3Bucket
