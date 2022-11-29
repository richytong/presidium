const DynamoTable = require('./DynamoTable')
const DynamoStream = require('./DynamoStream')
const ElasticsearchIndex = require('./ElasticsearchIndex')
const S3Bucket = require('./S3Bucket')
const KinesisStream = require('./KinesisStream')

/**
 * @name teardown
 *
 * @synopsis
 * ```coffeescript [specscript]
 * teardown(
 *   dependency DynamoTable|DynamoStream
 *              |ElasticsearchIndex|S3Bucket
 *              |KinesisStream
 * ) -> Promise<>
 * ```
 */
const teardown = async function (dependency) {
  if (dependency == null) {
    // noop
  }
  else if (dependency.constructor == DynamoTable) {
    await dependency.delete()
  }
  else if (dependency.constructor == DynamoStream) {
    dependency.close()
  }
  else if (dependency.constructor == ElasticsearchIndex) {
    await dependency.delete()
  }
  else if (dependency.constructor == S3Bucket) {
    await dependency.deleteAllObjects()
    await dependency.delete()
  }
  else if (dependency.constructor == KinesisStream) {
    dependency.close()
    await dependency.delete()
  }
}

module.exports = teardown
