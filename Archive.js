const tar = require('tar-stream')
const fs = require('fs/promises')
const pathWalk = require('./internal/pathWalk')
const isArray = require('./internal/isArray')
const parsePath = require('./internal/parsePath')
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
 * new Archive(base Object<path=>(content string)>) -> Archive
 * ```
 */
const Archive = function (base) {
  if (this == null || this.constructor != Archive) {
    return new Archive(base)
  }
  this.base = base == null ? {} : base
  return this
}

/**
 * @name Archive.prototype.tar
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Archive(base?).tar(path string, options {
 *   ignore: Array<string>, // paths or names to ignore
 * }) -> HotReadableStream
 * ```
 *
 * @description
 * Note: `path` must be absolute
 * Note: Returned readable stream is hot, so please pipe this immediately
 * Note: pack.packing is a Promise that represents the entire packing operation of the tar
 * Note: pack.packing resolves when the tar operation is complete
 */
Archive.prototype.tar = function archiveTar(path, options) {
  const pathWithSlash = path.endsWith('/') ? path : `${path}/`,
    ignore = get('ignore')(options),
    pack = tar.pack()
  pack.packing = pipe([
    curry.arity(2, pathWalk, __, { ignore }),
    reduce(async (pack, filePath) => {
      pack.entry({
        name: filePath.replace(pathWithSlash, ''),
        ...pick([
          'size', 'mode', 'mtime', 'uid', 'gid',
        ])(await fs.stat(filePath)),
      }, await fs.readFile(filePath))
      return pack
    }, pack),
    tap(pack => {
      for (const basePath in this.base) {
        pack.entry({ name: basePath }, this.base[basePath])
      }
      pack.finalize()
    }),
  ])(path)
  return pack
}

/**
 * @name Archive.prototype.untar
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Archive(base?).untar(
 *   archive Archive,
 *   options {
 *     ignore: Array<string>, // paths or names to ignore
 *   },
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
