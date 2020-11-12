const S3Client = require('aws-sdk/clients/s3')

/**
 * @name S3
 *
 * @synopsis
 * ```coffeescript [specscript]
 * S3(s3 string|S3Client|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }) -> S3
 * ```
 */
const S3 = function (value, options) {
  if (this == null || this.constructor != S3) {
    return new S3(s3)
  }
  if (typeof value == 'string') {
    this.s3 = new S3Client({
      apiVersion: '2006-03-01',
      accessKeyId: 'accessKey',
      secretAccessKey: 'secretKey',
      region: 'x-x-x',
      endpoint: value,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      ...options,
    })
  } else if (value.constructor == S3) {
    this.s3 = value.s3
  } else if (value.constructor == S3Client) {
    this.s3 = value
  } else {
    this.s3 = new S3Client({
      apiVersion: '2006-03-01',
      accessKeyId: 'accessKey',
      secretAccessKey: 'secretKey',
      region: 'x-x-x',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      ...value,
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
  }).promise().catch(error => {
    if (error.name == 'NoSuchBucket') {
      return {}
    }
    throw error
  })
}

module.exports = S3
