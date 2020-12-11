const AWSS3 = require('aws-sdk/clients/s3')
const HttpAgent = require('./HttpAgent')

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
    return new S3(s3)
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
  }).promise().catch(error => {
    if (error.name == 'NoSuchBucket') {
      return {}
    }
    throw error
  })
}

module.exports = S3
