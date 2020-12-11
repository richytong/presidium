const Mongo = require('./Mongo')

/**
 * @name MongoCollection
 *
 * @synopsis
 * ```coffeescript [specscript]
 * MongoCollection({
 *   name: string, // 'my-collection'
 *   uri: `mongodb+srv://<user>:<password>@<cluster-url>/<db>`,
 * }) -> MongoCollection
 * ```
 *
 * @description
 * https://docs.mongodb.com/manual/reference/method/db.createCollection/
 */
const MongoCollection = function (options) {
  const mongo = Mongo(options.uri),
    collection = mongo.db(mongo.s.options.dbName).collection(options.name)
  collection.name = options.name
  collection.mongo = mongo
  collection.ready = mongo.ready
  return collection
}

module.exports = MongoCollection
