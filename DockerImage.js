const Archive = require('./Archive')
const Docker = require('./Docker')
const pipe = require('rubico/pipe')
const tap = require('rubico/tap')
const fork = require('rubico/fork')
const get = require('rubico/get')
const map = require('rubico/map')
const curry = require('rubico/curry')
const __ = require('rubico/__')
const querystring = require('querystring')
const zlib = require('zlib')
const pathJoin = require('./internal/pathJoin')
const isArray = require('./internal/isArray')
const stringifyJSON = require('./internal/stringifyJSON')
const { exec } = require('child_process')

/**
 * @name DockerImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerImage(dockerfile string, options {
 *   tags: Array<string>,
 * }) -> DockerImage
 * ```
 *
 * @description
 * ```javascript
 * DockerImage(`
 * FROM node:15-alpine
 * RUN apk add openssh openntp neovim
 * EXPOSE 8888`, {
 *   tags: ['my-image:latest'],
 * })
 * ```
 */
const DockerImage = function (name) {
  if (this == null || this.constructor != DockerImage) {
    return new DockerImage(name)
  }
  this.http = new Docker().http
  this.name = name
  return this
}

/**
 * @name DockerImage.prototype.build
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name).build(
 *   path string,
 *   options? {
 *     Dockerfile string,
 *     ignore: Array<string>, // paths or names to ignore in tarball
 *     archive: Object<path string)=>(content string)>, // object representation of the base archive for build context
 *   },
 * ) -> ()
 * ```
 *
 * @description
 * Build a Docker Image. `path` must be absolute
 */
DockerImage.prototype.build = async function (path, options) {
  const archive = new Archive(options?.archive)
  return this.http.post(`/build?${querystring.stringify({
    dockerfile: 'Dockerfile',
    t: this.name,
    forcerm: true,
  })}`, {
    body: archive.tar(path, {
      ignore: get('ignore', ['node_modules', '.git', '.nyc_output'])(options),
    }).pipe(zlib.createGzip()),
    headers: {
      'Content-Type': 'application/x-tar',
    },
  })
}

/**
 * @name DockerImage.prototype.push
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(dockerfile, opts).push(repository string, options {
 *   authorization: {
 *     username: string,
 *     password: string,
 *     email: string,
 *     serveraddress: string,
 *   }|{
 *     identitytoken: string,
 *   },
 * })
 * ```
 *
 * @TODO push in DockerImage.test.js
 * https://docs.docker.com/registry/deploying/
 */
DockerImage.prototype.push = function (repository, options) {
  return pipe([
    fork({
      image: pipe([
        name => name.split(':')[0],
        curry.arity(2, pathJoin, repository, __),
      ]),
      querystring: name => querystring.stringify({ tag: name.split(':')[1] }),
    }),
    ({
      image, querystring,
    }) => this.http.post(`/images/${image}/push?${querystring}`, {
      headers: {
        'X-Registry-Auth': pipe([
          get('authorization', { identitytoken: '' }),
          stringifyJSON,
        ])(options),
      },
    }),
  ])(this.name)
}

module.exports = DockerImage
