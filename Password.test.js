const Test = require('thunk-test')
const assert = require('assert')
const Password = require('./Password')

const test = new Test('Password', async function () {
  const plaintext = 'MyPassword!123'
  const hashed = await Password.hash(plaintext)
  await assert.rejects(
    Password.verify('incorrect', hashed),
    new Error('Invalid password'),
  )
  await Password.verify(plaintext, hashed) // should not throw
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
