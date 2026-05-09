const Test = require('thunk-test')
const assert = require('assert')
const Password = require('./Password')

const test = new Test('Password', async function integration() {
  const plaintext = 'MyPassword!123'
  const hashed = await Password.hash(plaintext)

  await assert.rejects(
    Password.verify('incorrect', hashed),
    new Error('Invalid password'),
  )

  await Password.verify(plaintext, hashed) // should not throw

  const crypto = require('crypto')

  cryptoScrypt = crypto.scrypt
  crypto.scrypt = (text, salt, n, cb) => {
    cb(new Error('test'))
  }

  await assert.rejects(
    Password.hash(plaintext),
    new Error('test')
  )

  let calls = 0
  crypto.scrypt = (text, salt, n, cb) => {
    if (calls === 0) {
      calls += 1
      return cryptoScrypt(text, salt, n, cb)
    } else {
      cb(new Error('test'))
    }
  }

  await assert.rejects(
    Password.verify(plaintext, hashed),
    new Error('test')
  )

  crypto.scrypt = cryptoScrypt

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
