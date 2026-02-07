require('rubico/global')
const fs = require('fs')

/**
 * @name Secrets
 *
 * @docs
 * ```coffeescript [specscript]
 * Secrets() -> secrets Promise<Object>
 * ```
 *
 * Presidium Secrets class. Consumes the `.secrets` file in the current directory.
 *
 * Arguments:
 *   * (none)
 *
 * Return:
 *   * `secrets` - a promise of an object of secret key-value pairs.
 *
 * ```javascript
 * const secrets = await Secrets()
 * console.log(secrets.mySecret) // ********
 * ```
 */
async function Secrets() {
  const secrets = pipe(fs.promises.readFile('.secrets'), [
    content => content.toString('utf8').trim().split('\n'),
    map(line => line.split('=')),
    Object.fromEntries,
  ])
  await fs.promises.rm('.secrets')

  return secrets
}

module.exports = Secrets
