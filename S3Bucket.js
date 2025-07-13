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
   *   * `ChecksumAlgorithm`- indicates the algorithm used to create the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `Expires` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `IfNoneMatch` - uploads the object only if the object key name does not already exist in the bucket. Otherwise, Amazon S3 responds with `412 Precondition Failed`. If a conflicting operation occurs during the upload, Amazon S3 responds with `409 ConditionalRequestConflict`. For more information, see [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232) and [Add preconditions to S3 operations with conditional requests](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html).
   *   * `GrantFullControl` - gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object.
   *   * `GrantRead` - allows the grantee to read the object data and its metadata.
   *   * `GrantReadACP` - allows the grantee to read the object ACL.
   *   * `GrantWriteACP` - allows the grantee to write the ACL for the applicable object.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption. If a KMS key doesn't exist in the same account, this value must be the Key ARN.
   *   * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information used for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *   * `BucketKeyEnabled` - if `true`, Amazon S3 uses the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `Tagging` - the [tag-set](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/what-are-tags.html) for the object encoded as URL query paramters (e.g. "Key1=Value1&Key2=Value2).
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - if `true`, a legal hold will be applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *
   * Response:
   *   * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *   * `ETag` - the entity tag or hash of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *   * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information used for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *   * `BucketKeyEnabled` - indicates that Amazon S3 used the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
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
   *   * `ChecksumAlgorithm`- indicates the algorithm used to create the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `Expires` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `IfNoneMatch` - uploads the object only if the object key name does not already exist in the bucket. Otherwise, Amazon S3 responds with `412 Precondition Failed`. If a conflicting operation occurs during the upload, Amazon S3 responds with `409 ConditionalRequestConflict`. For more information, see [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232) and [Add preconditions to S3 operations with conditional requests](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html).
   *   * `GrantFullControl` - gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object.
   *   * `GrantRead` - allows the grantee to read the object data and its metadata.
   *   * `GrantReadACP` - allows the grantee to read the object ACL.
   *   * `GrantWriteACP` - allows the grantee to write the ACL for the applicable object.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption. If a KMS key doesn't exist in the same account, this value must be the Key ARN.
   *   * `SSEKMSEncryptionContext` - additional [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) contextual information used for object encryption. The value for this header is a base64-encoded string of a UTF-8 encoded JSON value containing the encryption context as key-value pairs. This value is stored as object metadata and is passed automatically to AWS KMS for future `GetObject` operations on the object. For more information, see [Encryption context](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html#encryption-context) from the _Amazon S3 User Guide_.
   *   * `BucketKeyEnabled` - if `true`, Amazon S3 uses the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `Tagging` - the [tag-set](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/what-are-tags.html) for the object encoded as URL query paramters (e.g. "Key1=Value1&Key2=Value2).
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - if `true`, a legal hold will be applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *
   * Response:
   *   * `Location` - the URL of the uploaded object.
   *   * `ETag` - the entity tag or hash of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
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
   *   * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `BypassGovernanceRetention` - if `true`, S3 Object Lock bypasses [Governance mode](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html#object-lock-retention-modes) restrictions to process this operation. Requires the `s3:BypassGovernanceRetention` permission.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *
   * Response:
   *   * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *   * `VersionId` - version ID of the [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) created as a result of the DELETE operation.
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
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *   * `MFA` - the concatenation of the authentication device's serial number, a space, and the value displayed on the authentication device. Required to permanently delete a versioned object if versioning is configured with Multifactor Authentication (MFA) delete enabled. For more information, see [Configuring MFA delete](https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiFactorAuthenticationDelete.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *
   * Response:
   *   * `Deleted` - container for a successful delete.
   *     * `Key` - the name of a deleted object.
   *     * `VersionId` - the version ID of the deleted object.
   *     * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *     * `DeleteMarkerVersionId` - version ID of the [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) created as a result of the DELETE operation, or if a specific object version was deleted, the version ID of the deleted object version.
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
   * bucket.delete(options {
   *   Id: string,
   *   ExpectedBucketOwner: string
   * }) -> response Promise<{}>
   * ```
   *
   * ```javascript
   * await myBucket.delete()
   * ```
   *
   * Options:
   *   * `Id` - the ID of the [analytics configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/analytics-storage-class.html).
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   */
  delete(options = {}) {
    return this._s3.deleteBucket(this.name, options)
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
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA'|'COMPLETED',
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
   *
   * Options:
   *   * `IfMatch` - if the entity tag (ETag) in the response is different than the one specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. For more information, see [If-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1).
   *   * `IfModifiedSince` - if the object has not been modified since the time specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. If the `IfNoneMatch` option is specified, this option is ignored. For more information, see [If-Modified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3).
   *   * `IfNoneMatch` - if the object has the same entity tag (ETag) as the one specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. For more information, see [If-None-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2).
   *   * `IfUnmodifiedSince` - if the object has been modified since the time specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. If the `IfMatch` option is specified, this option is ignored. For more information, see [If-Unmodified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4).
   *   * `Range` - download only the byte range of the object specified by this option. For more information, see [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2).
   *   * `ResponseCacheControl` - sets the [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2) header of the response.
   *   * `ResponseContentDisposition` - sets the [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266) header of the response.
   *   * `ResponseContentEncoding` - sets the [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4) header of the response.
   *   * `ResponseContentLanguage` - sets the [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5) header of the response.
   *   * `ResponseContentType` - sets the [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3) header of the response.
   *   * `ResponseExpires` - sets the [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3) header of the response.
   *   * `VersionId` - the specific version of the object. If the version of the object specified by this option is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html), Amazon S3 responds with HTTP status code `405 Method Not Allowed`. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `PartNumber` - part number of the object being read. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *   * `ChecksumMode` - required to retrieve the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object.
   *
   * Response:
   *   * `Body` - the object data.
   *   * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *   * `AcceptRanges` - the range of bytes specified by the [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2) header of the request.
   *   * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *   * `Restore` - provides information about the object restoration action and expiration time of the restored object copy. For more information, see [Restoring an archived object](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html) from the _Amazon S3 User Guide_.
   *   * `LastModified` - date/time when the object was last modified.
   *   * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *   * `ETag` - the entity tag or hash of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `MissingMeta` - the number of metadata entries not returned in the headers that are prefixed with `x-amz-meta-`. For more information, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *   * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *   * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *   * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *   * `ContentRange` - the portion of the object returned in the response. For more information, see [Content-Range](https://datatracker.ietf.org/doc/html/rfc7233#section-4.2)
   *   * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *   * `Expires` - deprecated in favor of `ExpiresString`.
   *   * `ExpiresString` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *   * `BucketKeyEnabled` - indicates that Amazon S3 used the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   *   * `ReplicationStatus` - the progress of replicating objects between buckets. For more information, see [Replicating objects within and across Regions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html).
   *   * `PartsCount` - the parts count of the object. This value is only returned if the `PartNumber` option was specified and the object was uploaded as a multipart upload. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *   * `TagCount` - the number of tags on the object.
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - indicates the status of the legal hold applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
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
   * ) -> response Promise<{
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
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA'|'COMPLETED',
   *   PartsCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|DateString|TimestampSecond
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF'
   * }>
   * ```
   *
   * ```javascript
   * const response = await myBucket.headObject('my-key')
   * ```
   *
   * Options:
   *   * `IfMatch` - if the entity tag (ETag) in the response is different than the one specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. For more information, see [If-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1).
   *   * `IfModifiedSince` - if the object has not been modified since the time specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. If the `IfNoneMatch` option is specified, this option is ignored. For more information, see [If-Modified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3).
   *   * `IfNoneMatch` - if the object has the same entity tag (ETag) as the one specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. For more information, see [If-None-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2).
   *   * `IfUnmodifiedSince` - if the object has been modified since the time specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. If the `IfMatch` option is specified, this option is ignored. For more information, see [If-Unmodified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4).
   *   * `Range` - download only the byte range of the object specified by this option. For more information, see [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2).
   *   * `ResponseCacheControl` - sets the [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2) header of the response.
   *   * `ResponseContentDisposition` - sets the [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266) header of the response.
   *   * `ResponseContentEncoding` - sets the [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4) header of the response.
   *   * `ResponseContentLanguage` - sets the [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5) header of the response.
   *   * `ResponseContentType` - sets the [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3) header of the response.
   *   * `ResponseExpires` - sets the [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3) header of the response.
   *   * `VersionId` - the specific version of the object. If the version of the object specified by this option is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html), Amazon S3 responds with HTTP status code `405 Method Not Allowed`. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `PartNumber` - part number of the object being read. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *   * `ChecksumMode` - required to retrieve the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object.
   *
   * Response:
   *   * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *   * `AcceptRanges` - the range of bytes specified by the [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2) header of the request.
   *   * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *   * `Restore` - provides information about the object restoration action and expiration time of the restored object copy. For more information, see [Restoring an archived object](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html) from the _Amazon S3 User Guide_.
   *   * `ArchiveStatus` - archive status of the object.
   *   * `LastModified` - date/time when the object was last modified.
   *   * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *   * `ETag` - the entity tag or hash of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `MissingMeta` - the number of metadata entries not returned in the headers that are prefixed with `x-amz-meta-`. For more information, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *   * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *   * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *   * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *   * `ContentRange` - the portion of the object returned in the response. For more information, see [Content-Range](https://datatracker.ietf.org/doc/html/rfc7233#section-4.2)
   *   * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *   * `Expires` - deprecated in favor of `ExpiresString`.
   *   * `ExpiresString` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *   * `BucketKeyEnabled` - indicates that Amazon S3 used the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   *   * `ReplicationStatus` - the progress of replicating objects between buckets. For more information, see [Replicating objects within and across Regions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html).
   *   * `PartsCount` - the parts count of the object. This value is only returned if the `PartNumber` option was specified and the object was uploaded as a multipart upload. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - indicates the status of the legal hold applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   */
  headObject(key, options) {
    return this._s3.headObject(this.name, key, options)
  }

  /**
   * @name getObjectStream
   *
   * @docs
   * Retrieve a [Readable Stream](https://nodejs.org/api/stream.html#class-streamreadable) of an object from the S3 Bucket.
   *
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * bucket.getObjectStream(key string, options {
   *   IfMatch: string,
   *   IfModifiedSince: Date|DateString|TimestampSeconds,
   *   IfNoneMatch: string,
   *   IfUnmodifiedSince: Date|DateString|TimestampSeconds,
   *   Range: string, # 'bytes=0-9'
   *   ResponseCacheControl: string,
   *   ResponseContentDisposition: string,
   *   ResponseContentEncoding: string,
   *   ResponseContentLanguage: string,
   *   ResponseContentType: string,
   *   ResponseExpires: Date|Date.toString()|number,
   *   VersionId: string,
   *   SSECustomerAlgorithm: string,
   *   SSECustomerKey: Buffer|TypedArray|Blob|string,
   *   SSECustomerKeyMD5: string,
   *   RequestPayer: requester,
   *   PartNumber: number,
   *   ExpectedBucketOwner: string,
   *   ChecksumMode: 'ENABLED',
   * }) -> response stream.Readable {
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
   *   ReplicationStatus: 'COMPLETE'|'PENDING'|'FAILED'|'REPLICA'|'COMPLETED',
   *   PartsCount: number,
   *   ObjectLockMode: GOVERNANCE'|'COMPLIANCE,
   *   ObjectLockRetainUntilDate: Date|DateString|TimestampSecond
   *   ObjectLockLegalHoldStatus: 'ON'|'OFF'
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
   *
   * Options:
   *   * `IfMatch` - if the entity tag (ETag) in the response is different than the one specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. For more information, see [If-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.1).
   *   * `IfModifiedSince` - if the object has not been modified since the time specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. If the `IfNoneMatch` option is specified, this option is ignored. For more information, see [If-Modified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.3).
   *   * `IfNoneMatch` - if the object has the same entity tag (ETag) as the one specified in this option, Amazon S3 responds with HTTP status code `304 Not Modified`. For more information, see [If-None-Match](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2).
   *   * `IfUnmodifiedSince` - if the object has been modified since the time specified in this option, Amazon S3 responds with HTTP status code `412 Precondition Failed`. If the `IfMatch` option is specified, this option is ignored. For more information, see [If-Unmodified-Since](https://datatracker.ietf.org/doc/html/rfc7232#section-3.4).
   *   * `Range` - download only the byte range of the object specified by this option. For more information, see [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2).
   *   * `ResponseCacheControl` - sets the [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2) header of the response.
   *   * `ResponseContentDisposition` - sets the [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266) header of the response.
   *   * `ResponseContentEncoding` - sets the [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4) header of the response.
   *   * `ResponseContentLanguage` - sets the [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5) header of the response.
   *   * `ResponseContentType` - sets the [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3) header of the response.
   *   * `ResponseExpires` - sets the [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3) header of the response.
   *   * `VersionId` - the specific version of the object. If the version of the object specified by this option is a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html), Amazon S3 responds with HTTP status code `405 Method Not Allowed`. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKey` - the customer-provided encryption key used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `PartNumber` - part number of the object being read. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *   * `ChecksumMode` - required to retrieve the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object.
   *
   * Response:
   *   * `DeleteMarker` - if `true`, the current version or specified object version that was permanently deleted was a [delete marker](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html) before deletion.
   *   * `AcceptRanges` - the range of bytes specified by the [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2) header of the request.
   *   * `Expiration` - if the expiration is configured for the object (see [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) from the _Amazon S3 User Guide_), this header will be present in the response. Includes the `expiry-date` and `rule-id` key-value pairs that provide information about object expiration. The value of the `rule-id` is URL-encoded.
   *   * `Restore` - provides information about the object restoration action and expiration time of the restored object copy. For more information, see [Restoring an archived object](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html) from the _Amazon S3 User Guide_.
   *   * `ArchiveStatus` - archive status of the object.
   *   * `LastModified` - date/time when the object was last modified.
   *   * `ContentLength` - indicates the object's data length as a non-negative integer number of bytes. For more information, see [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).
   *   * `ETag` - the entity tag or hash of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32` - the base64-encoded, 32-bit CRC-32 [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumCRC32C` - the base64-encoded, 32-bit CRC-32C [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA1` - the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `ChecksumSHA256` - the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *   * `MissingMeta` - the number of metadata entries not returned in the headers that are prefixed with `x-amz-meta-`. For more information, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `VersionId` - the specific version of the object. For more information, see [Retaining multiple versions of objects with S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) from the _Amazon S3 User Guide_.
   *   * `CacheControl` - lists directives for caches along the request/response chain. For more information, see [Cache-Control](https://www.rfc-editor.org/rfc/rfc9111#section-5.2).
   *   * `ContentDisposition` - conveys additional information about how to process the response payload. For more information, see [Content-Disposition](https://www.rfc-editor.org/rfc/rfc6266#section-4).
   *   * `ContentEncoding` - indicates what content coding(s) have been applied to the object in order to obtain data in the media type referenced by the `ContentType` option. For more information, see [Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4).
   *   * `ContentLanguage` - describes the natural language(s) of the intended audience for the object. For more information, see [Content-Language](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5)
   *   * `ContentRange` - the portion of the object returned in the response. For more information, see [Content-Range](https://datatracker.ietf.org/doc/html/rfc7233#section-4.2)
   *   * `ContentType` - indicates the media type of the object. For more information, see [Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).
   *   * `Expires` - deprecated in favor of `ExpiresString`.
   *   * `ExpiresString` - the date/time after which the object is considered stale. For more information, see [Expires](https://www.rfc-editor.org/rfc/rfc7234#section-5.3).
   *   * `WebsiteRedirectLocation` - if a bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see [Working with object metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html) from the _Amazon S3 User Guide_.
   *   * `ServerSideEncryption` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `Metadata` - [metadata](https://www.ibm.com/think/topics/metadata) about the object.
   *   * `SSECustomerAlgorithm` - the server-side encryption algorithm used for object encryption. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSECustomerKeyMD5` - the 128-bit MD5 digest of the encryption key according to [RFC 1321](https://www.ietf.org/rfc/rfc1321.txt). Amazon S3 uses this header to check for message integrity. For more information, see [Using server-side encryption with Amazon S3 managed keys (SSE-S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html) from the _Amazon S3 User Guide_.
   *   * `SSEKMSKeyId` - the [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) Key ID, Key ARN, or Key Alias used for object encryption.
   *   * `BucketKeyEnabled` - indicates that Amazon S3 used the S3 bucket key for object encryption with [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) keys (SSE-KMS).
   *   * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   *   * `ReplicationStatus` - the progress of replicating objects between buckets. For more information, see [Replicating objects within and across Regions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html).
   *   * `PartsCount` - the parts count of the object. This value is only returned if the `PartNumber` option was specified and the object was uploaded as a multipart upload. For more information, see [Uploading and copying objects using multipart upload in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockMode` - the object lock mode. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockRetainUntilDate` - the date/time when the object's Object Lock expires. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *   * `ObjectLockLegalHoldStatus` - indicates the status of the legal hold applied to the object. For more information, see [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) from the _Amazon S3 User Guide_.
   *
   */
  getObjectStream(key, options) {
    return this._s3.getObjectStream(this.name, key, options)
  }

  /**
   * @name listObjects
   *
   * @docs
   * Retrieve some or all (up to 1,000) objects from the S3 Bucket. Objects are returned in [lexicographical order](https://help.splunk.com/en/splunk-cloud-platform/search/spl2-search-manual/sort-and-order/lexicographical-order).
   *
   * ```coffeescript [specscript]
   * bucket.listObjects(options {
   *   Delimiter: string,
   *   EncodingType: 'url',
   *   MaxKeys: number,
   *   Prefix: string,
   *   ContinuationToken: string,
   *   FetchOwner: boolean,
   *   StartAfter: string,
   *   RequestPayer: requester,
   *   ExpectedBucketOwner: string,
   *   OptionalObjectAttributes: ['RestoreStatus']
   * }) -> response Promise<{
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
   *
   * Options:
   *   * `Delimiter` - character used to group keys. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *   * `EncodingType` - encoding type of the [object keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) in the response. If specified as `url`, object keys in the response use [percent-encoding](https://datatracker.ietf.org/doc/html/rfc3986#section-2.1).
   *   * `MaxKeys` - maximum number of keys returned in the response. Defaults to `1000`.
   *   * `Prefix` - limits the response to keys that begin with the specified prefix.
   *   * `ContinuationToken` - indicates to Amazon S3 that the list is being continued on this bucket with a token. Used to paginate list results.
   *   * `FetchOwner` - if `true`, the `Owner` field indicating the owner of the object will be present with each key in the response.
   *   * `StartAfter` - the key after which Amazon S3 will start listing in [lexicographical order](https://help.splunk.com/en/splunk-cloud-platform/search/spl2-search-manual/sort-and-order/lexicographical-order).
   *   * `RequestPayer` - confirms that the requester knows that they will be charged for the request. Bucket owners do not need to specify this parameter for their requests.
   *   * `ExpectedBucketOwner` - the AWS account ID of the expected bucket owner. If the provided account ID does not match the actual owner of the bucket, Amazon S3 responds with HTTP status code `403 Forbidden`.
   *   * `OptionalObjectAttributes` - optional fields to be returned in the response.
   *
   * Response:
   *   * `IsTruncated` - set to `true` if there are more keys available in the bucket to retrieve.
   *   * `Contents` - data and metadata about each object returned.
   *     * `Key` - a name or path that uniquely identifies the object. For more information, see [Naming Amazon S3 objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) from the _Amazon S3 User Guide_.
   *     * `LastModified` - creation date of the object.
   *     * `ETag` - the entity tag or hash of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `ChecksumAlgorithm`- indicates the algorithm used to create the [checksum](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Checksum.html) of the object. For more information, see [Checking object integrity in Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) from the _Amazon S3 User Guide_.
   *     * `Size` - size or data length in bytes of the object.
   *     * `StorageClass` - the [storage class](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) associated with the object. Defaults to `STANDARD`.
   *     * `Owner` - the owner of the object.
   *       * `DisplayName` - the display name of the owner.
   *       * `ID` - the ID of the owner.
   *     * `RestoreStatus` - the restoration status of an object. For more information, see [Working with archived objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/archived-objects.html) from the _Amazon S3 User Guide_.
   *       * `IsRestoreInProgress` - if `true`, object restoration is in progress.
   *       * `RestoreExpiryDate` - indicates when the restored copy will expire. This value is populated only if the object has already been restored.
   *   * `Name` - the bucket name.
   *   * `Prefix` - limits the response to keys that begin with the specified prefix.
   *   * `Delimiter` - character used to group keys. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *   * `MaxKeys` - maximum number of keys returned in the response. Defaults to `1000`.
   *   * `CommonPrefixes` - common prefixes of keys returned in place of the actual keys. Used to browse keys hierachically. For more information, see [Organizing objects using prefixes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) from the _Amazon S3 User Guide_.
   *     * `Prefix` - the value for a common prefix.
   *   * `EncodingType` - encoding type of the [object keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) in the response. If specified as `url`, object keys in the response use [percent-encoding](https://datatracker.ietf.org/doc/html/rfc3986#section-2.1).
   *   * `KeyCount` - actual number of keys in the response.
   *   * `ContinuationToken` - the value of `ContinuationToken` specified in the request.
   *   * `NextContinuationToken` - indicates there are more keys available in the bucket to be listed. To continue the list, this value should be used as the `ContinuationToken` for the next list objects request.
   *   * `StartAfter` - the value of `StartAfter` specified in the request.
   *   * `RequestCharged` - indicates that the requester was successfully charged for the request.
   *
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
