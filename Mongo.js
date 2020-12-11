const { MongoClient, ObjectID } = require('mongodb')

/**
 * @name Mongo
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Mongo(uri `mongodb+srv://<user>:<password>@<host>/<db>`) -> Mongo
 * ```
 *
 * @description
 * Replace the following with your MongoDB deployment's connection string.
 *
 * Note: `uri` must include the database parameter `db`
 *
 * Node.js MongoDB Driver API Usage
 * https://docs.mongodb.com/drivers/node/usage-examples
 *
 * Collection API
 * http://mongodb.github.io/node-mongodb-native/3.6/api/Collection.html
 *
 * How to create a database
 * https://stackoverflow.com/questions/35758008/create-database-node-js-with-mongodb
 */
const Mongo = function (uri) {
  const mongo = new MongoClient(uri, {
    useUnifiedTopology: true,
    keepAlive: true,
  })
  mongo.ready = mongo.connect()
  return mongo
}

Mongo.ObjectID = ObjectID

module.exports = Mongo
