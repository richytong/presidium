require('rubico/global')
const { identity } = require('rubico/x')
const S3Client = require('../aws-sdk/clients/s3')

/**
 * @name S3
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> S3
 * ```
 *
 * @reference
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
 */
class S3 {
  constructor(options) {
    this.client = new S3Client({
      ...options,
      apiVersion: '2006-03-01',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    })
  }

  /**
   * @name createBucket
   *
   * @synopsis
   * ```coffeescript [specscript]
   * createBucket(bucketname string, options? {
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
   */
  createBucket(bucketname, options) {
    return this.client.createBucket({
      Bucket: bucketname,
      ...options,
    }).promise()
  }

  /**
   * @name deleteBucket
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteBucket(bucketname string) -> Promise<{}>
   * ```
   *
   * @description
   * Deletes an [AWS S3](https://aws.amazon.com/s3/) Bucket.
   *
   * ```javascript
   * S3(s3).deleteBucket('my-bucket')
   * ```
   */
  deleteBucket(bucketname) {
    return this.client.deleteBucket({
      Bucket: bucketname,
    }).promise()
  }

  /**
   * @name getBucketLocation
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getBucketLocation(bucketname string) -> { LocationConstraint: string } # 'us-west-1'
   * ```
   */
  getBucketLocation(bucketname) {
    return this.client.getBucketLocation({ Bucket: bucketname }).promise()
  }

  /**
   * @name putObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * putObject(
   *   bucketname string,
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
  putObject(bucketname, key, body, options) {
    return this.client.putObject({
      Bucket: bucketname,
      Key: key,
      Body: body,
      ...options,
    }).promise()
  }

  /**
   * @name upload
   *
   * @synopsis
   * ```coffeescript [specscript]
   * upload(
   *   bucketname string,
   *   key string,
   *   body Buffer|TypedArray|Blob|String|ReadableStream,
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
  upload(bucketname, key, body, options) {
    return this.client.upload({
      Bucket: bucketname,
      Key: key,
      Body: body,
      ...options,
    }).promise()
  }

  /**
   * @name deleteObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteObject(bucketname string, key string, options? {
   *   BypassGovernanceRetention?: boolean,
   *   ExpectedBucketOwner?: string,
   *   MFA?: string,
   *   RequestPayer?: requester,
   *   VersionId?: string,
   * }) -> Promise
   * ```
   */
  deleteObject(bucketname, key, options) {
    return this.client.deleteObject({
      Bucket: bucketname,
      Key: key,
      ...options,
    }).promise()
  }

  /**
   * @name deleteObjects
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteObjects(bucketname string, keys Array<string>, options? {
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
  deleteObjects(bucketname, keys, options) {
    const { Quiet = false, ...optionsRest } = options ?? {}
    return this.client.deleteObjects({
      Bucket: bucketname,
      Delete: {
        Objects: keys.map(all({ Key: identity })),
        Quiet,
      },
      ...optionsRest,
    }).promise()
  }

  /**
   * @name getObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getObject(
   *   bucketname string,
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
  getObject(bucketname, key, options) {
    return this.client.getObject({
      Bucket: bucketname,
      Key: key,
      ...options,
    }).promise()
  }

  /**
   * @name headObject
   *
   * @synopsis
   * ```coffeescript [specscript]
   * headObject(
   *   bucketname string,
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
   *   Range?: string, // 'bytes=0-9'
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
  headObject(bucketname, key, options = {}) {
    return this.client.headObject({
      Bucket: bucketname,
      Key: key,
      ...options,
    }).promise()
  }

  /**
   * @name getObjectStream
   *
   * @synopsis
   * ```coffeescript [specscript]
   * module stream
   *
   * getObjectStream(bucketname string, key string, options {
   *   ExpectedBucketOwner?: string,
   *   IfMatch?: string,
   *   IfModifiedSince?: Date|Date.toString()|number,
   *   IfNoneMatch?: string,
   *   IfUnmodifiedSince?: Date|Date.toString()|number,
   *   PartNumber?: number,
   *   Range?: string,
   *   RequestPayer?: requester,
   *   ResponseCacheControl?: string,
   *   ResponseContentDisposition?: string,
   *   ResponseContentEncoding?: string,
   *   ResponseContentLanguage?: string,
   *   ResponseContentType?: string,
   *   ResponseExpires?: Date|Date.toString()|number,
   *   SSECustomerAlgorithm?: string,
   *   SSECustomerKey?: string|Buffer,
   *   SSECustomerKeyMD5?: string,
   *   VersionId?: string,
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
   *     ServerSideEncryption?: 'AES256'|'aws:kms',
   *     Metadata?: Object<string>,
   *     Range?: string, // 'bytes=0-9'
   *     SSECustomerAlgorithm?: string,
   *     SSECustomerKey?: string,
   *     SSEKMSKeyId?: string,
   *     StorageClass?: 'STANDARD'|'REDUCED_REDUNDANCY'|'STANDARD_IA'|'ONEZONE_IA'|'INTELLIGENT_TIERING'|'GLACIER'|'DEEP_ARCHIVE'|'OUTPOSTS',
   *     RequestCharged?: string,
   *     ReplicationStatus?: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA',
   *     PartsCount: number,
   *     TagCount: number,
   *     ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *     ObjectLockRetainUntilDate?: Date|Date.toString()|number,
   *     ObjectLockLegalHoldStatus?: 'ON'|'OFF',
   *   },
   * }
   * ```
   */
  async getObjectStream(bucketname, key, options = {}) {
    const headRes = await this.headObject(bucketname, key, options)

    const rs = this.client.getObject({
      Bucket: bucketname,
      Key: key,
      ...options,
    }).createReadStream()

    rs.headers = headRes

    return rs
  }

  /**
   * @name listObjectsV2
   *
   * @synopsis
   * ```coffeescript [specscript]
   * listObjectsV2(bucketname string, options? {
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
  listObjectsV2(bucketname, options) {
    return this.client.listObjectsV2({
      Bucket: bucketname,
      ...options,
    }).promise()
  }
}

module.exports = S3
