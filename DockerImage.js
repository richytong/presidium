const Archive = require('./Archive')
const Docker = require('./Docker')
const isArray = require('./internal/isArray')
const pipe = require('rubico/pipe')
const get = require('rubico/get')
const map = require('rubico/map')
const tap = require('rubico/tap')
const transform = require('rubico/transform')
const querystring = require('querystring')
const zlib = require('zlib')
const parseJSON = require('./internal/parseJSON')

/**
 * @name DockerImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerImage(dockerfile string) -> DockerImage
 * ```
 *
 * @description
 * ```javascript
 * DockerImage(`
 * FROM node:15-alpine
 * RUN apk add openssh openntp neovim
 * EXPOSE 8888`)
 * ```
 */
const DockerImage = function (dockerfile) {
  if (this == null || this.constructor != DockerImage) {
    return new DockerImage(dockerfile)
  }
  this.http = new Docker().http
  this.dockerfile = dockerfile
  return this
}

/**
 * @name DockerImage.prototype.build
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(dockerfile).build(
 *   path string,
 *   options? {
 *     tags Array<string>, // <name>:<tag>
 *     ignore: Array<string>, // paths or names to ignore in tarball
 *   },
 * ) -> ()
 * ```
 *
 * @description
 * Build a Docker Image. `path` must be absolute
 *
 * @TODO refactor tarball to TarArchive
 */
DockerImage.prototype.build = async function (path, options) {
  const archive = new Archive({
    ignore: isArray(options?.ignore)
      ? options.ignore
      : ['Dockerfile', 'node_modules', '.git', '.nyc_output'],
    defaults: {
      Dockerfile: this.dockerfile,
    },
  })

  const response = await this.http.post(`/build?${querystring.stringify({
    dockerfile: 'Dockerfile',
    t: get('tags', [])(options),
  })}`, {
    // body: (await archive.tar(path)).pipe(zlib.createGzip()),
    body: await archive.tar(path),
    headers: {
      'Content-Type': 'application/x-tar',
    },
  })
  return response
}

DockerImage.prototype.push = function (remote, options) {}

module.exports = DockerImage
