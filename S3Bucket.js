const S3 = require('./S3')
const fork = require('rubico/fork')
const identity = require('rubico/x/identity')

/**
 * @name S3Bucket
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(s3 string|AWSS3|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }, bucketname string) -> S3Bucket
 * ```
 */
const S3Bucket = function (s3, bucketname) {
  if (this == null || this.constructor != S3Bucket) {
    return new S3Bucket(s3, bucketname)
  }
  this.s3 = new S3(s3).s3
  this.bucketname = bucketname
  // TODO this.ready
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
S3Bucket.prototype.putObject = function putObject(key, body, options) {
  return this.s3.putObject({
    Bucket: this.bucketname,
    Key: key,
    Body: body,
    ...options,
  }).promise()
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
S3Bucket.prototype.deleteObject = function deleteObject(key, options) {
  return this.s3.deleteObject({
    Bucket: this.bucketname,
    Key: key,
    ...options,
  }).promise()
}

/**
 * @name S3Bucket.prototype.deleteObjects
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3Bucket(s3).deleteObjects(key string, options? {
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
S3Bucket.prototype.deleteObjects = function deleteObjects(keys, options) {
  const { Quiet = false, ...optionsRest } = options == null ? {} : options
  return this.s3.deleteObjects({
    Bucket: this.bucketname,
    Delete: {
      Objects: keys.map(fork({ Key: identity })),
      Quiet,
    },
    ...optionsRest,
  }).promise()
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
S3Bucket.prototype.getObject = function getObject(key, options) {
  return this.s3.getObject({
    Bucket: this.bucketname,
    Key: key,
    ...options,
  }).promise()
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
S3Bucket.prototype.listObjects = function listObjectsV2(options) {
  return this.s3.listObjectsV2({
    Bucket: this.bucketname,
    ...options,
  }).promise()
}

module.exports = S3Bucket
