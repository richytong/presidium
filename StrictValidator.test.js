const Test = require('thunk-test')
const assert = require('assert')
const StrictValidator = require('./StrictValidator')

const test = new Test('StrictValidator', StrictValidator)

.case({}, function testEmptyValidator(validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 0)
})

.case({
  a: function identity(value) { return value }
}, function testIdentityValidator(validator) {
  const payload1 = validator({ a: undefined })
  assert.equal(Object.keys(payload1).length, 1)
  assert.strictEqual(payload1.a, undefined)

  const payload2 = validator({ a: null })
  assert.equal(Object.keys(payload2).length, 1)
  assert.strictEqual(payload2.a, null)

  const error = new Error('Missing field a')
  error.code = 400
  assert.throws(() => validator({}), error)
})

.case({ a: Number }, function testNumberValidator(validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 1)
  assert.strictEqual(payload.a, 1)

  const error = new Error('Missing field a')
  error.code = 400
  assert.throws(() => validator({}), error)
})

.case({ a: String }, function testStringValidator(validator) {
  const payload = validator({ a: 1 })
  assert.equal(Object.keys(payload).length, 1)
  assert.strictEqual(payload.a, '1')
})

.case({ a: Number, b: String }, { onMissing() {} }, function testNumberStringValidator(validator) {
  assert.deepEqual(validator({}), {})
  assert.deepEqual(validator({ a: 1, b: 'd' }), { a: 1, b: 'd' })
  assert.deepEqual(validator({ a: 1 }), { a: 1 })
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
