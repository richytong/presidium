const Test = require('thunk-test')
const assert = require('assert')
const OptionalValidator = require('./OptionalValidator')

const test = new Test('OptionalValidator', OptionalValidator)

.case({}, function (validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 0)
})

.case({ a: Number }, function (validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 1)
  assert.strictEqual(payload.a, 1)

  assert.deepEqual(validator({}), {})
})

.case({ a: String }, function (validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 1)
  assert.strictEqual(payload.a, '1')
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
