const DynamoDB = require('./DynamoDB')
const S3Bucket = require('./S3Bucket')

const Dependency = {}

/**
 * @name Dependency.teardown
 *
 * @synopsis
 * ```coffeescript [specscript]
 * teardown(
 *   dependency DynamoDB.Table|DynamoDB.Stream|S3Bucket
 * ) -> Promise<>
 * ```
 */
Dependency.teardown = async function teardown(dependency) {
  if (dependency == null) {
    // noop
  }
  else if (dependency.constructor == DynamoDB.Table) {
    await dependency.delete()
  }
  else if (dependency.constructor == DynamoDB.Stream) {
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
