require('rubico/global')
const fs = require('fs')
const resolvePath = require('./internal/resolvePath')

/**
 * @name NpmToken
 *
 * @docs
 * ```coffeescript [specscript]
 * NpmToken(options {
 *   recurse: boolean, # defaults to true
 * }) -> npmToken Promise<string>
 * ```
 *
 * Finds the [npm token](https://docs.npmjs.com/creating-and-viewing-access-tokens) from the `.npmrc` credentials file.
 *
 * Arguments:
 *   * `options`
 *     * `recurse` - whether to recursively look into parent directories until the `.npmrc` file is found. Defaults to `true`.
 *
 * Return:
 *   * `npmToken` - a promise of the npm token.
 *
 * ```javascript
 * const npmToken = await NpmToken()
 * ```
 */

const NpmToken = async function (options = {}) {
  const recurse = options.recurse ?? true
  const npmrc = '.npmrc'
  let npmrcDir = resolvePath(process.cwd())
  let lines = ''
  while (recurse && npmrcDir != '/') {
    const npmrcFilePath = resolvePath(npmrcDir, '.npmrc')
    if (fs.existsSync(npmrcFilePath)) {
      lines = await fs.promises.readFile(npmrcFilePath)
        .then(buffer => buffer.toString('utf8').split('\n'))
      break
    }
    npmrcDir = resolvePath(npmrcDir, '..')
  }

  if (lines == '') {
    throw new Error('Missing .npmrc file')
  }

  return pipe(lines, [
    get(0),
    value => (/\/\/registry.npmjs.org\/:_authToken=(.+)/g).exec(value),
    get(1),
  ])
}

module.exports = NpmToken
