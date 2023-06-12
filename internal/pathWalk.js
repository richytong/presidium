require('rubico/global')
const fs = require('fs/promises')
const pathResolve = require('./pathResolve')
const isArray = require('./isArray')

/**
 * @name pathWalk
 *
 * @synopsis
 * ```coffeescript [specscript]
 * pathWalk(path, options? {
 *   ignore: Array<string>, // names or paths
 * }) -> Promise<Array<string>>
 * ```
 *
 * @description
 * ```javascript
 * pathWalk('./my/path/', {
 *   ignore: ['node_modules', '.github'],
 * }) // -> Promise<paths Array<string>>
 * ```
 */
const pathWalk = function (path, options) {
  const ignore = new Set(get('ignore', [])(options))
  return pipe([
    pathResolve,
    tryCatch(
      curry.arity(2, fs.readdir, __, { withFileTypes: true }),
      () => []),

    flatMap(dirent => {
      const direntName = dirent.name,
        direntPath = pathResolve(path, direntName)
      if (
        ignore.size > 0
          && (ignore.has(direntName) || ignore.has(direntPath))
      ) {
        return []
      }
      if (dirent.isDirectory()) {
        return pathWalk(direntPath)
      }
      return [direntPath]
    }),
  ])(path)
}

module.exports = pathWalk
