require('rubico/global')
const fs = require('fs')
const resolvePath = require('./internal/resolvePath')

/**
 * @name NpmToken
 *
 * @synopsis
 * ```coffeescript [specscript]
 * NpmToken(options {
 *   recurse: boolean,
 * }) -> Promise<npmToken string>
 * ```
 *
 * @description
 * Finds the npm token from `~/.npmrc`
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
