require('rubico/global')
const fs = require('fs/promises')
const { minimatch } = require('minimatch')
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
const pathWalk = async function (path, options = {}) {
  const { ignore = [] } = options
  const absPath = pathResolve(path)
  const dirents = await fs.readdir(absPath, { withFileTypes: true })
  const result = []

  for (const dirent of dirents) {
    const dirName = dirent.name
    const dirPath = pathResolve(path, dirName)
    let shouldIgnore = false
    for (const pattern of ignore) {
      if (minimatch(dirPath, pattern) || minimatch(dirName, pattern)) {
        shouldIgnore = true
        break
      }
    }

    if (shouldIgnore) {
      continue
    }

    if (dirent.isDirectory()) {
      const subPaths = await pathWalk(dirPath, options)
      result.push(...subPaths)
    } else {
      result.push(dirPath)
    }
  }

  return result
}

module.exports = pathWalk
