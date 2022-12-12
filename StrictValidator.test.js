const Test = require('thunk-test')
const assert = require('assert')
const StrictValidator = require('./StrictValidator')

const test = new Test('StrictValidator', StrictValidator)

.case({}, function (validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 0)
})

.case({ a: Number }, function (validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 1)
  assert.strictEqual(payload.a, 1)

  const error = new Error('missing field a')
  error.code = 400
  assert.throws(() => validator({}), error)
})

.case({ a: String }, function (validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 1)
  assert.strictEqual(payload.a, '1')
})

.case({ a: Number, b: String }, { onMissing() {} }, function (validator) {
  assert.deepEqual(validator({}), {})
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
