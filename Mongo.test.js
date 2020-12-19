const assert = require('assert')
const Test = require('thunk-test')
const Mongo = require('./Mongo')

module.exports = Test('Mongo', Mongo)
  .case({ uri: 'mongodb://localhost:27017/my-db' }, async function (mongo) {
    await mongo.ready
    assert.equal(mongo.s.options.dbName, 'my-db')
    assert(mongo.s.options.keepAlive)
    return () => {
      mongo.close()
    }
  })
