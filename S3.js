const rubico = require('rubico')
const AWSS3 = require('aws-sdk/clients/s3')
const HttpAgent = require('./HttpAgent')
const identity = require('rubico/x/identity')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

/**
 * @name S3
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(connection string|AWSS3|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }) -> S3
 * ```
 */
const S3 = function (connection, options) {
  if (this == null || this.constructor != S3) {
    return new S3(connection, options)
  }

  if (typeof connection == 'string') {
    this.s3 = new AWSS3({
      apiVersion: '2006-03-01',
      accessKeyId: 'accessKey',
      secretAccessKey: 'secretKey',
      region: 'x-x-x',
      httpOptions: { agent: HttpAgent() },
      endpoint: connection,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      ...options,
    })
  } else {
    this.s3 = new AWSS3({
      apiVersion: '2006-03-01',
      accessKeyId: 'accessKey',
      secretAccessKey: 'secretKey',
      region: 'x-x-x',
      httpOptions: { agent: HttpAgent() },
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      ...connection,
    })
  }
  return this
}

/**
 * @name S3.prototype.createBucket
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(s3).createBucket(bucketname string, options? {
 *   ACL?: 'private'|'public-read'|'public-read-write'|'authenticated-read',
 *   CreateBucketConfiguration: {
 *     LocationConstraint: string,
 *   },
 *   GrantFullControl: string,
 *   GrantRead: string,
 *   GrantReadACP: string,
 *   GrantWrite: string,
 *   GrantWriteACP: string,
 *   ObjectLockEnabledForBucket: boolean,
 * })
 * ```
 *
 * @description
 * Creates an [AWS S3](https://aws.amazon.com/s3/) Bucket.
 *
 * ```javascript
 * S3(s3).createBucket('my-bucket')
 * ```
 */
S3.prototype.createBucket = function createBucket(bucketname, options) {
  return this.s3.createBucket({
    Bucket: bucketname,
    ...options,
  }).promise()
}

/**
 * @name S3.prototype.deleteBucket
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(s3).deleteBucket(bucketname string)
 * ```
 *
 * @description
 * Deletes an [AWS S3](https://aws.amazon.com/s3/) Bucket.
 *
 * ```javascript
 * S3(s3).deleteBucket('my-bucket')
 * ```
 */
S3.prototype.deleteBucket = function deleteBucket(bucketname) {
  return this.s3.deleteBucket({
    Bucket: bucketname,
  }).promise().catch(() => ({}))
}

/**
 * @name S3.prototype.getBucketLocation
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options).getBucketLocation(bucketname string)
 *   -> { LocationConstraint: string } // 'us-west-1'
 * ```
 */
S3.prototype.getBucketLocation = function s3GetBucketLocation(bucketname) {
  return this.s3.getBucketLocation({ Bucket: bucketname }).promise()
}

/**
 * @name S3.prototype.putObject
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options).putObject(
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
S3.prototype.putObject = function s3PutObject(bucketname, key, body, options) {
  return this.s3.putObject({
    Bucket: bucketname,
    Key: key,
    Body: body,
    ...options,
  }).promise()
}

/**
 * @name S3.prototype.deleteObject
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options).deleteObject(key string, options? {
 *   BypassGovernanceRetention?: boolean,
 *   ExpectedBucketOwner?: string,
 *   MFA?: string,
 *   RequestPayer?: requester,
 *   VersionId?: string,
 * }) -> Promise
 * ```
 */
S3.prototype.deleteObject = function s3DeleteObject(bucketname, key, options) {
  return this.s3.deleteObject({
    Bucket: bucketname,
    Key: key,
    ...options,
  }).promise()
}

/**
 * @name S3.prototype.deleteObjects
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options).deleteObjects(keys Array<string>, options? {
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
S3.prototype.deleteObjects = function s3DeleteObjects(bucketname, keys, options) {
  const { Quiet = false, ...optionsRest } = options ?? {}
  return this.s3.deleteObjects({
    Bucket: bucketname,
    Delete: {
      Objects: keys.map(fork({ Key: identity })),
      Quiet,
    },
    ...optionsRest,
  }).promise()
}

/**
 * @name S3.prototype.getObject
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options).getObject(
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

S3.prototype.getObject = function s3GetObject(bucketname, key, options) {
  return this.s3.getObject({
    Bucket: bucketname,
    Key: key,
    ...options,
  }).promise()
}

/**
 * @name S3.prototype.listObjectsV2
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options).listObjectsV2(options? {
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

S3.prototype.listObjectsV2 = function s3ListObjectsV2(bucketname, options) {
  return this.s3.listObjectsV2({
    Bucket: bucketname,
    ...options,
  }).promise()
}

module.exports = S3
