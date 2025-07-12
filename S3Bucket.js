require('rubico/global')
const _S3 = require('./internal/_S3')

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

    this._s3 = new _S3({ ...awsCreds })

    this.ready = this._s3.getBucketLocation(this.name).then(() => {
      return { message: 'bucket-exists' }
    }).catch(async error => {
      if (error.name == 'NoSuchBucket') {
        await this._s3.createBucket(this.name).catch(() => {})
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
   *   SSECustomerAlgorithm: 'AES256'|'aws:kms'|'aws:kms:dsse',
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
   *   * `ACL` - the [canned access control list (ACL)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html#canned-acl) to apply to the object. For more information, see [Access control list (ACL) overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html) from the _Amazon S3 User Guide_.
   *   * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *   * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *   * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *   * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *   * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *   * `ContentMD5` - the base64-encoded 128-bit MD5 digest of the object. For more information, see [RFC 1864](https://datatracker.ietf.org/doc/html/rfc1864).
   *   * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *   * `ChecksumAlgorithm`- indicates the algorithm used to create the checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `Expires` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `IfNoneMatch` - uploads the object only if the object key name does not already exist in the bucket. Otherwise, Amazon S3 responds with `412 Precondition Failed`. If a conflicting operation occurs during the upload, Amazon S3 responds with `409 ConditionalRequestConflict`. For more information, see [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232) and [Add preconditions to S3 operations with conditional requests](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html).
   *   * `GrantFullControl` - gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object.
   *   * `GrantRead` - allows the grantee to read the object data and its metadata.
   *   * `GrantReadACP` - allows the grantee to read the object ACL.
   *   * `GrantWriteACP` - allows the grantee to write the ACL for the applicable object.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `ServerSideEncryption` - the server-side encryption algorithm to use for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm to use for object encryption.
   *   * `SSECustomerKey` - the customer-provided encryption key to use for object encryption.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias to use for object encryption. If a KMS key doesn't exist in the same account, this value must be the Key ARN.
   *   * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information to use for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *   * `BucketKeyEnabled` - if `true`, Amazon S3 uses the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests. If either the source or destination S3 bucket has Requester Pays enabled, the requester will pay for corresponding charges to copy the object. For information about downloading objects from Requester Pays buckets, see [Downloading objects from Requester Pays buckets](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ObjectsinRequesterPaysBuckets.html) from the _Amazon S3 User Guide_.
   *   * `Tagging` - the [tag-set](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/what-are-tags.html) for the object encoded as URL query paramters (e.g. "Key1=Value1&Key2=Value2).
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - if `true`, a legal hold will be applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, the request fails with HTTP status code `403 Forbidden`.
   *
   * Response:
   *   * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *   * `ETag` - the entity tag or hash of the object. The ETag reflects changes only to the contents of an object, not its metadata.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ServerSideEncryption` - the server-side encryption algorithm to use for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `VersionId` - a specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm to use for object encryption.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias to use for object encryption. If a KMS key doesn't exist in the same account, this value must be the Key ARN.
   *   * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information to use for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *   * `BucketKeyEnabled` - if `true`, Amazon S3 uses the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   */
  putObject(key, body, options) {
    return this._s3.putObject(this.name, key, body, options)
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
   * ) -> response Promise<{
   *   Location: string,
   *   ETag: string,
   *   Bucket: string,
   *   Key: string
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
   *
   * Options:
   *   * `ACL` - the [canned access control list (ACL)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html#canned-acl) to apply to the object. For more information, see [Access control list (ACL) overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html) from the _Amazon S3 User Guide_.
   *   * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *   * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *   * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *   * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *   * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *   * `ContentMD5` - the base64-encoded 128-bit MD5 digest of the object. For more information, see [RFC 1864](https://datatracker.ietf.org/doc/html/rfc1864).
   *   * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *   * `ChecksumAlgorithm`- indicates the algorithm used to create the checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C checksum of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `Expires` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `IfNoneMatch` - uploads the object only if the object key name does not already exist in the bucket. Otherwise, Amazon S3 responds with `412 Precondition Failed`. If a conflicting operation occurs during the upload, Amazon S3 responds with `409 ConditionalRequestConflict`. For more information, see [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232) and [Add preconditions to S3 operations with conditional requests](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html).
   *   * `GrantFullControl` - gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object.
   *   * `GrantRead` - allows the grantee to read the object data and its metadata.
   *   * `GrantReadACP` - allows the grantee to read the object ACL.
   *   * `GrantWriteACP` - allows the grantee to write the ACL for the applicable object.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `ServerSideEncryption` - the server-side encryption algorithm to use for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm to use for object encryption.
   *   * `SSECustomerKey` - the customer-provided encryption key to use for object encryption.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias to use for object encryption. If a KMS key doesn't exist in the same account, this value must be the Key ARN.
   *   * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information to use for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *   * `BucketKeyEnabled` - if `true`, Amazon S3 uses the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests. If either the source or destination S3 bucket has Requester Pays enabled, the requester will pay for corresponding charges to copy the object. For information about downloading objects from Requester Pays buckets, see [Downloading objects from Requester Pays buckets](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ObjectsinRequesterPaysBuckets.html) from the _Amazon S3 User Guide_.
   *   * `Tagging` - the [tag-set](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/what-are-tags.html) for the object encoded as URL query paramters (e.g. "Key1=Value1&Key2=Value2).
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - if `true`, a legal hold will be applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, the request fails with HTTP status code `403 Forbidden`.
   *
   * Response:
   *   * `Location` - the URL of the uploaded object.
   *   * `ETag` - the entity tag or hash of the object. The ETag reflects changes only to the contents of an object, not its metadata.
   *   * `Bucket` - the name of the bucket to which the object was uploaded.
   *   * `Key` - the key under which the object was uploaded.
   */
  upload(key, body, options) {
    return this._s3.upload(this.name, key, body, options)
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
   * }) -> response Promise<{
   *   DeleteMarker: boolean,
   *   VersionId: string,
   *   RequestCharged: 'requester',
   * }>
   * ```
   *
   * ```javascript
   * await myBucket.deleteObject('my-key')
   * ```
   *
   * Options:
   *   * `MFA` - the concatenation of the authentication device's serial number, a space, and the value displayed on the authentication device. Required to permanently delete a versioned object if versioning is configured with Multifactor Authentication (MFA) delete enabled. For more information, see [Configuring MFA delete](https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiFactorAuthenticationDelete.html) from the _Amazon S3 User Guide_.
   *   * `VersionId` - a specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests. If either the source or destination S3 bucket has Requester Pays enabled, the requester will pay for corresponding charges to copy the object. For information about downloading objects from Requester Pays buckets, see [Downloading objects from Requester Pays buckets](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ObjectsinRequesterPaysBuckets.html) from the _Amazon S3 User Guide_.
   *   * `BypassGovernanceRetention` - if `true`, S3 Object Lock bypasses [Governance mode](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html#object-lock-retention-modes) restrictions to process this operation. Requires the `s3:BypassGovernanceRetention` permission.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, the request fails with HTTP status code `403 Forbidden`.
   *
   * Response:
   *   * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *   * `VersionId` - version ID of the delete marker created as a result of the DELETE operation.
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   */
  deleteObject(key, options) {
    return this._s3.deleteObject(this.name, key, options)
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
   *     RequestPayer: requester
   *   }
   * ) -> response Promise<{
   *   Deleted: Array<{
   *     Key: string,
   *     VersionId: string,
   *     DeleteMarker: boolean,
   *     DeleteMarkerVersionId: string
   *   }>,
   *   RequestCharged: 'requester',
   *   Errors: Array<{
   *     Key: string,
   *     VersionId: string,
   *     Code: string
   *   }>
   * }>
   * ```
   *
   * Options:
   *   * `Quiet` - if `true`, enables quiet mode for the request. In quiet mode, the response includes only keys where the delete operation encountered an error. For a successful delete operation in quiet mode, the operation does not return any information about the delete in the response.
   *   * `BypassGovernanceRetention` - if `true`, S3 Object Lock bypasses [Governance mode](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html#object-lock-retention-modes) restrictions to process this operation. Requires the `s3:BypassGovernanceRetention` permission.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, the request fails with HTTP status code `403 Forbidden`.
   *   * `MFA` - the concatenation of the authentication device's serial number, a space, and the value displayed on the authentication device. Required to permanently delete a versioned object if versioning is configured with Multifactor Authentication (MFA) delete enabled. For more information, see [Configuring MFA delete](https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiFactorAuthenticationDelete.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests. If either the source or destination S3 bucket has Requester Pays enabled, the requester will pay for corresponding charges to copy the object. For information about downloading objects from Requester Pays buckets, see [Downloading objects from Requester Pays buckets](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ObjectsinRequesterPaysBuckets.html) from the _Amazon S3 User Guide_.
   *
   * Response:
   *   * `Deleted` - container for a successful delete.
   *     * `Key` - the name of a deleted object.
   *     * `VersionId` - the version ID of the deleted object.
   *     * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *     * `DeleteMarkerVersionId` - version ID of the delete marker created as a result of the DELETE operation, or if a specific object version was deleted, the version ID of the deleted object version.
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   *   * `Errors` - container for a failed delete.
   *     * `Key` - the name of the object of the attempted delete.
   *     * `VersionId` - the version ID of the object of the attempted delete.
   *     * `Code` - a response code that uniquely identifies the error condition. For a complete list of error responses, see [Error responses](https://docs.aws.amazon.com/AmazonS3/latest/API/ErrorResponses.html) from the _Amazon S3 API_.
   *
   * ```javascript
   * await myBucket.deleteObjects(['my-key-1', 'my-key-2'])
   * ```
   */
  deleteObjects(keys, options) {
    return this._s3.deleteObjects(this.name, keys, options)
  }

  /**
   * @name deleteAllObjects
   *
   * @docs
   * Remove all objects from an S3 Bucket.
   *
   * ```coffeescript [specscript]
   * bucket.deleteAllObjects(options {
   *   Quiet: boolean,
   *   BypassGovernanceRetention: boolean,
   *   ExpectedBucketOwner: string,
   *   MFA: string,
   *   RequestPayer: requester,
   *   BatchSize: number
   * }) -> response Promise<{
   *   Deleted: Array<{
   *     Key: string,
   *     VersionId: string,
   *     DeleteMarker: boolean,
   *     DeleteMarkerVersionId: string,
   *   }>,
   *   RequestCharged: 'requester',
   *   Errors: Array<{
   *     Key: string,
   *     VersionId: string,
   *     Code: string
   *   }>
   * }>
   * ```
   *
   * ```javascript
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
      if (response1.RequestCharged) {
        response.RequestCharged = response1.RequestCharged
      }
      if (response1.Errors) {
        response.Errors ??= []
        response.Errors = response.Errors.concat(response1.Errors)
      }
    }

    return response
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
    return this._s3.deleteBucket(this.name)
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
    return this._s3.getObject(this.name, key, options)
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
    return this._s3.headObject(this.name, key, options)
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
    return this._s3.getObjectStream(this.name, key, options)
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
    return this._s3.listObjectsV2(this.name, options).catch(error => {
      if (error.retryable) {
        return this.listObjects(options)
      }
      throw error
    })
  }
}

module.exports = S3Bucket
