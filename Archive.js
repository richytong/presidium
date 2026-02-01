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
 * @docs
 * ```coffeescript [specscript]
 * new Archive(contentObject Object<string>) -> archive Archive
 * ```
 */
class Archive {
  constructor(contentObject) {
    this.contentObject = contentObject == null ? {} : contentObject
  }

  /**
   * @name tar
   *
   * @docs
   * ```coffeescript [specscript]
   * module tar 'https://github.com/mafintosh/tar-stream'
   *
   * tar(path string, options {
   *   ignore: Array<string>,
   * }) -> pack tar.Pack
   * ```
   *
   * Bundle multiple files and directories from a parent directory into a tarball.
   *
   * Arguments:
   *   * `path` - the path to the parent directory which contains the files and directories to bundle.
   *   * `options`
   *     * `ignore` - filepaths, filenames, or patterns to ignore.
   */
  tar(path, options) {
    const pathWithSlash = path.endsWith('/') ? path : `${path}/`
    const ignore = get(options, 'ignore')
    const pack = tar.pack()

    pipe(path, [
      curry.arity(2, pathWalk, __, { ignore }),

      reduce(async (pack, filepath) => {
        pack.entry({
          name: filepath.replace(pathWithSlash, ''),
          ...pipe([
            fs.stat,
            pick(['size', 'mode', 'mtime', 'uid', 'gid']),
          ])(filepath),
        }, await fs.readFile(filepath))
        return pack
      }, pack),

      tap(pack => {
        for (const filename in this.contentObject) {
          pack.entry({ name: filename }, this.contentObject[filename])
        }
        pack.finalize()
      }),
    ])

    return pack
  }

  /**
   * @name untar
   *
   * @docs
   * ```coffeescript [specscript]
   * module tar 'https://github.com/mafintosh/tar-stream'
   * module presidium 'https://presidium.services/docs'
   *
   * untar(pack tar.Pack) ->
   *   contentMap Promise<Map<(filepath string)=>(content presidium.Readable)> >
   * ```
   *
   * Extract a tarball into a map of file paths to content streams.
   *
   * Arguments:
   *   * `pack` - a tarball represented by the `tar.Pack` type. Returned by the [tar](#tar) method.
   */
  untar(pack) {
    const extractStream = tar.extract()
    const extracted = new Map()
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

}

module.exports = Archive
