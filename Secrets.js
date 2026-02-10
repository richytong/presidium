require('rubico/global')
const fs = require('fs')

/**
 * @name Secrets
 *
 * @docs
 * ```coffeescript [specscript]
 * Secrets(filepath string) -> secrets Promise<Object>
 * ```
 *
 * Presidium Secrets class. Consumes the `.secrets` file in the current directory.
 *
 * Arguments:
 *   * `filepath` - optional path to the secrets file. Defaults to `'.secrets'`.
 *
 * Return:
 *   * `secrets` - a promise of an object of secret key-value pairs.
 *
 * ```javascript
 * const secrets = await Secrets()
 * console.log(secrets.mySecret) // ********
 * ```
 */
async function Secrets(filepath = '.secrets') {
  const secrets = pipe(fs.promises.readFile(filepath), [
    content => content.toString('utf8').trim().split('\n'),
    map(line => line.split('=')),
    Object.fromEntries,
  ])
  await fs.promises.rm(filepath)

  return secrets
}

module.exports = Secrets
