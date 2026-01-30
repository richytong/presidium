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
 * new Archive(base Object<string>) -> archive Archive
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
 * module tar 'https://github.com/mafintosh/tar-stream'
 *
 * archive.tar(path string, options {
 *   ignore: Array<string>, // paths or names to ignore
 * }) -> pack tar.Pack
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
        ...pipe([
          fs.stat,
          pick(['size', 'mode', 'mtime', 'uid', 'gid']),
        ])(filePath),
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
 * module tar 'https://github.com/mafintosh/tar-stream'
 *
 * archive.untar(
 *   pack tar.Pack,
 *   options {
 *     ignore: Array<string>, // paths or names to ignore
 *   },
 * ) -> Map<(header EntryHeader)=>(stream EntryStream)>
 * ```
 */
Archive.prototype.untar = function archiveUntar(pack) {
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
    pack.pipe(extractStream)
  })
}

module.exports = Archive
