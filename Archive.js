const tar = require('tar-stream')
const fs = require('fs/promises')
const pathWalk = require('./internal/pathWalk')
const isArray = require('./internal/isArray')
const pipe = require('rubico/pipe')
const tap = require('rubico/tap')
const get = require('rubico/get')
const reduce = require('rubico/reduce')
const thunkify = require('rubico/thunkify')
const curry = require('rubico/curry')
const __ = require('rubico/__')
const pick = require('rubico/pick')

/**
 * @name Archive
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Archive(options? {
 *   ignore: Array<string>, // paths or names to ignore
 *   defaults: Object<path=>(content string)>, // default entries for the archive
 * }) -> Archive
 * ```
 */
const Archive = function (options) {
  if (this == null || this.constructor != Archive) {
    return new Archive(options)
  }
  if (options == null) {
    return this
  }
  this.ignore = get('ignore', [])(options)
  this.defaults = get('defaults', {})(options)
  return this
}

/**
 * @name Archive.prototype.compress
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Archive(options).compress(path string)
 * ```
 *
 * @description
 * Note: `path` must be absolute
 */
Archive.prototype.tar = function archiveTar(path) {
  const pathWithSlash = path.endsWith('/') ? path : `${path}/`
  return pipe([
    curry.arity(2, pathWalk, __, {
      ignore: this.ignore,
    }),
    reduce(async (pack, filePath) => {
      const shouldIgnore = this.ignore.length > 1
        && this.ignore.includes(filePath)
      if (!shouldIgnore) {
        pack.entry({
          name: filePath.replace(pathWithSlash, ''),
          ...pick([
            'size', 'mode', 'mtime', 'uid', 'gid',
          ])(await fs.stat(filePath)),
        }, await fs.readFile(filePath))
      }
      return pack
    }, tar.pack()),
    tap(pack => {
      for (const defaultPath in this.defaults) {
        pack.entry({ name: defaultPath }, this.defaults[defaultPath])
      }
      pack.finalize()
    }),
  ])(path)
}

/**
 * @name Archive.prototype.untar
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Archive(options).untar(
 *   archive Archive,
 * ) -> Map<(header EntryHeader)=>(stream EntryStream)>
 * ```
 */
Archive.prototype.untar = function archiveUntar(archive) {
  const extractStream = tar.extract(),
    extracted = new Map()
  return new Promise((resolve, reject) => {
    extractStream.on('entry', (header, stream, next) => {
      stream.header = header
      extracted.set(header.name, stream)
      next()
    })
    extractStream.on('finish', thunkify(resolve, extracted))
    extractStream.on('error', reject)
    archive.pipe(extractStream)
  })
}

module.exports = Archive
