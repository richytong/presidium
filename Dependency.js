const DynamoTable = require('./DynamoTable')
const DynamoStream = require('./DynamoStream')
const S3Bucket = require('./S3Bucket')

const Dependency = {}

/**
 * @name Dependency.teardown
 *
 * @synopsis
 * ```coffeescript [specscript]
 * teardown(
 *   dependency DynamoTable|DynamoStream|S3Bucket
 * ) -> Promise<>
 * ```
 */
Dependency.teardown = async function teardown(dependency) {
  if (dependency == null) {
    // noop
  }
  else if (dependency.constructor == DynamoTable) {
    await dependency.delete()
  }
  else if (dependency.constructor == DynamoStream) {
    dependency.close()
  }
  else if (dependency.constructor == S3Bucket) {
    await dependency.deleteAllObjects()
    await dependency.delete()
  }
  else if (typeof dependency.destroy == 'function') {
    await dependency.destroy()
  }

  dependency?.timers?.forEach(clearInterval)
}

module.exports = Dependency
