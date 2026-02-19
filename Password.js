const crypto = require('crypto')

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
 * Password.hash(plaintext string) -> hash Promise<string>
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
Password.hash = async function hash(plaintext) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(10).toString('hex')
    crypto.scrypt(plaintext, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error)
      }
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
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

Password.verify = async function verify(plaintext, hashed) {
  const [salt, derivedKey] = hashed.split(':')
  const hashedPlaintext = await Password.hash(plaintext)

  const hashed1 = await new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, 64, (error, derivedKey1) => {
      if (error) {
        reject(error)
      }
      resolve(`${salt}:${derivedKey1.toString('hex')}`)
    })
  })

  if (hashed == hashed1) {
    return undefined
  }
  throw new Error('Invalid password')
}

module.exports = Password
