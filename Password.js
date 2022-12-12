const bcrypt = require('bcrypt')

const Password = {}

/**
 * @name Password.hash
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Password.hash(plaintext string) -> hashed string
 * ```
 */

Password.hash = async function (plaintext) {
  const salt = await bcrypt.genSalt(10)
  const hashed = await bcrypt.hash(plaintext, salt)
  return hashed
}

/**
 * @name Password.verify
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Password.verify(plaintext string, hashed string) -> ()
 * ```
 */

Password.verify = async function (plaintext, hashed) {
  const isValid = await bcrypt.compare(plaintext, hashed)
  if (!isValid) {
    throw new Error('Invalid password')
  }
  return undefined
}

module.exports = Password
