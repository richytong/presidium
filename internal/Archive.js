require('rubico/global')
const tarStream = require('tar-stream')
const fs = require('fs/promises')
const walk = require('./walk')
const pipe = require('rubico/pipe')
const tap = require('rubico/tap')
const get = require('rubico/get')
const reduce = require('rubico/reduce')
const thunkify = require('rubico/thunkify')
const pick = require('rubico/pick')

/**
 * @name Archive
 */
const Archive = {}

/**
 * @name Archive.tar
 *
 * @docs
 * ```coffeescript [specscript]
 * module tar 'https://github.com/mafintosh/tar-stream'
 *
 * Archive.tar(path string, options {
 *   ignore: Array<string>,
 *   base: Object<string>,
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
Archive.tar = function tar(path, options) {
  const pathWithSlash = path.endsWith('/') ? path : `${path}/`
  const ignore = get(options, 'ignore')
  const pack = tarStream.pack()

  pipe(path, [
    walk,
    filter(path => {
      for (const part of ignore) {
        if (path.includes(part)) {
          return false
        }
      }
      return true
    }),

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
      const base = options.base ?? {}
      for (const filename in base) {
        pack.entry({ name: filename }, base[filename])
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
 * Archive.untar(pack tar.Pack) ->
 *   contentMap Promise<Map<(filepath string)=>(content presidium.Readable)> >
 * ```
 *
 * Extract a tarball into a map of file paths to content streams.
 *
 * Arguments:
 *   * `pack` - a tarball represented by the `tar.Pack` type. Returned by the [tar](#tar) method.
 */
Archive.untar = function untar(pack) {
  const extractStream = tarStream.extract()
  const extracted = new Map()
  return new Promise((resolve, reject) => {
    extractStream.on('entry', (header, stream, next) => {
      stream.header = header
      extracted.set(header.name, stream)
      next()
    })

    extractStream.on('finish', () => {
      resolve(extracted)
    })

    extractStream.on('error', reject)

    pack.pipe(extractStream)
  })
}

module.exports = Archive
