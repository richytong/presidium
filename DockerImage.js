const rubico = require('rubico')
const identity = require('rubico/x/identity')
const Archive = require('./Archive')
const Docker = require('./Docker')
const querystring = require('querystring')
const zlib = require('zlib')
const { exec } = require('child_process')
const pathJoin = require('./internal/pathJoin')
const isArray = require('./internal/isArray')
const stringifyJSON = require('./internal/stringifyJSON')
const startsWith = require('./internal/startsWith')
const split = require('./internal/split')
const join = require('./internal/join')
const toString = require('./internal/toString')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

/**
 * @name DockerImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerImage(name string) -> DockerImage
 * ```
 *
 * @description
 * Encapsulates `docker build` and `docker push`
 *
 * ```javascript
 * new DockerImage('my-app:latest')
 * ```
 */
const DockerImage = function (name) {
  if (this == null || this.constructor != DockerImage) {
    return new DockerImage(name)
  }
  this.name = name
  this.docker = new Docker()
  this.http = this.docker.http
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
 *     ignore: Array<string>, // paths or names to ignore in tarball
 *     archive: Object<path string)=>(content string)>, // object representation of the base archive for build context
 *     archiveDockerfile: string, // path to Dockerfile in archive
 *   },
 * ) -> ()
 * ```
 *
 * @description
 * Build a Docker Image. `path` must be absolute
 *
 * ```javascript
 * DockerImage(name).build(path string, {
 *   archive: {
 *     Dockerfile: `
 * FROM node:15-alpine
 * RUN apk add openssh neovim
 * EXPOSE 8888`,
 *   },
 *   ignore: ['Dockerfile'],
 * })
 *
 * Dockerfile Syntax
 * ```sh
 * HEALTHCHECK \
 *   [--interval=<duration '30s'|string>] \
 *   [--timeout=<duration '30s'|string>] \
 *   [--start-period=<duration '0s'|string>] \
 *   [--retries=<3|number>] \
 * CMD <string>
 *
 * ENV <key>=<value> ...<key>=<value>
 *
 * EXPOSE <port> [...<port>/<protocol 'tcp'|'udp'>]
 *
 * WORKDIR <path>
 *
 * VOLUME ["<path>", ..."<paths>"]|<paths string>
 *
 * USER <user>[:<group>]|<UID>[:<GID>]
 *
 * ENTRYPOINT ["<executable>", ..."<parameter>"]
 *   |"<command> ...<parameter>"
 *
 * CMD ["<executable>", ..."<parameter>"] # exec form
 *   |[..."<parameter>"] # default parameters to ENTRYPOINT
 *   |"<command> ...<parameter>" # shell form
 * ```
 */
DockerImage.prototype.build = async function (path, options = {}) {
  const archive = new Archive(options?.archive)
  return this.http.post(`/build?${querystring.stringify({
    dockerfile: options.archiveDockerfile ?? 'Dockerfile',
    t: this.name,
    forcerm: true,
  })}`, {
    body: archive.tar(path, {
      ignore: options.ignore ?? ['node_modules', '.git', '.nyc_output'],
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
 * DockerImage(name).push(repository string, options {
 *   authorization: {
 *     username: string,
 *     password: string,
 *     email: string,
 *     serveraddress: string,
 *   }|{
 *     identitytoken: string,
 *   },
 * }) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://docs.docker.com/registry/deploying/
 */
DockerImage.prototype.push = function (repository, options = {}) {
  return pipe([
    fork({
      image: pipe([
        name => name.split(':')[0],
        curry.arity(2, pathJoin, repository, __),
      ]),
      search: name => querystring.stringify({ tag: name.split(':')[1] }),
    }),
    ({
      image, search,
    }) => this.http.post(`/images/${image}/push?${search}`, {
      headers: {
        'X-Registry-Auth': stringifyJSON(
          options.authorization ?? { identitytoken: '' }),
      },
    }),
  ])(this.name)
}

module.exports = DockerImage
