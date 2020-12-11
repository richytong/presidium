const assert = require('assert')
const Test = require('thunk-test')
const MongoCollection = require('./MongoCollection')

module.exports = Test('MongoCollection', MongoCollection)
  .case({
    uri: 'mongodb://localhost:27017/my-db',
    name: 'my-collection',
  }, async function (collection) {
    await collection.ready
    assert.equal(collection.name, 'my-collection')
    assert.equal(typeof collection.findOne, 'function')
    assert.equal(typeof collection.find, 'function')
    assert.equal(typeof collection.insertOne, 'function')
    assert.equal(typeof collection.insertMany, 'function')
    assert.equal(typeof collection.updateOne, 'function')
    assert.equal(typeof collection.updateMany, 'function')
    assert.equal(typeof collection.deleteOne, 'function')
    assert.equal(typeof collection.deleteMany, 'function')
    return () => {
      collection.mongo.close()
    }
  })()
