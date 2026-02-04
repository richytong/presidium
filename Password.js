const bcrypt = require('bcrypt')

/**
 * @name Password
 *
 * @docs
 * Presidium Password class. Contains methods for storing and verifying passwords.
 */
const Password = {}

/**
 * @name Password.hash
 *
 * @docs
 * ```coffeescript [specscript]
 * Password.hash(plaintext string) -> hash string
 * ```
 *
 * Creates a hash of the plaintext password.
 *
 * Arguments:
 *   * `plaintext` - the plaintext password.
 *
 * Return:
 *   * `hash` a promise of the hash of the plaintext password.
 *
 * ```javascript
 * const myPassword = '********'
 *
 * const myPasswordHash = await Password.hash(myPassword)
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
 * @docs
 * ```coffeescript [specscript]
 * Password.verify(plaintext string, hash string) -> undefinedPromise Promise<undefined>
 * ```
 *
 * Verifies a password hash.
 *
 * Arguments:
 *   * `plaintext` - the input plaintext password.
 *   * `hash` - the hash of the correct password.
 *
 * Return:
 *   * `undefinedPromise` - a promise of undefined.
 *
 * Throws:
 *   * `Error: Invalid password` - thrown if the hash of the input plaintext password is different from the hash of the correct password.
 *
 * ```javascript
 * const myPassword = '********'
 *
 * const myPasswordHash = await Password.hash(myPassword)
 *
 * const passwordGuess = 'password'
 *
 * await Password.verify(passwordGuess, myPasswordHash) // Error: Invalid password
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
