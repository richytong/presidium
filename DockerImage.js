require('rubico/global')
const Transducer = require('rubico/Transducer')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const trace = require('rubico/x/trace')
const defaultsDeep = require('rubico/x/defaultsDeep')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
const Docker = require('./Docker')
const stream = require('stream')
const pathJoin = require('./internal/pathJoin')
const parseJSON = require('./internal/parseJSON')

const passthrough = target => transform(Transducer.passthrough, target)

const PassThroughStream = stream.PassThrough

/**
 * @name DockerImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name string) -> DockerImage
 * ```
 *
 * @synopsis
 * Build and push Docker images.
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
const DockerImage = function (name) {
  if (this == null || this.constructor != DockerImage) {
    return new DockerImage(name)
  }
  this.name = name
  this.docker = new Docker()
  return this
}

/**
 * @name DockerImage.prototype.pull
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name).pull(options {
 *   repo: string, // additional path prefix saved on this machine
 *   tag?: string, // if not in name
 *   message?: string, // commit message for image
 *   platform?: ''|'<os>[/arch[/variant]]'
 *   username: string,
 *   password: string,
 *   email?: string,
 *   serveraddress?: string,
 *   identitytoken?: string,
 * }) -> ReadableStream
 * ```
 */
DockerImage.prototype.pull = function (options) {
  const result = new PassThroughStream()
  result.promise = new Promise((resolve, reject) => {
    this.docker.pullImage(this.name, pick([
      'repo', 'tag', 'message', 'platform',
      'username', 'password', 'email', 'serveraddress', 'identitytoken',
    ])(options)).then(response => {
      response.body.on('end', resolve)
      response.body.on('error', reject)
      response.body.pipe(result)
    })
  })
  return result
}

/**
 * @name DockerImage.prototype.build
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name, dockerfile).build(
 *   path string,
 *   options? {
 *     ignore: Array<string>, // paths or names to ignore in build context tarball
 *     archive: Object<path string)=>(content string)>, // object representation of the base archive for build context
 *     platform: string, // e.g. linux/x86_64
 *   },
 * ) -> ReadableStream
 * ```
 */
DockerImage.prototype.build = function (path, options = {}) {
  const result = new PassThroughStream()
  result.promise = new Promise((resolve, reject) => {
    this.docker.buildImage(
      this.name,
      path,
      pick(['ignore', 'archive', 'platform'])(options),
    ).then(response => {
      response.body.on('end', resolve)
      response.body.on('error', reject)
      response.body.pipe(result)
    })
  })
  return result
}

/**
 * @name DockerImage.prototype.push
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name, dockerfile).push(repository string, options {
 *   authorization: {
 *     username: string,
 *     password: string,
 *     email: string,
 *     serveraddress: string,
 *   }|{
 *     identitytoken: string,
 *   },
 * }) -> ReadableStream
 * ```
 */
DockerImage.prototype.push = function (repository, options) {
  const result = new PassThroughStream()
  result.promise = new Promise((resolve, reject) => {
    this.docker.tagImage(this.name, {
      tag: this.name.split(':')[1],
      repo: pathJoin(repository, this.name.split(':')[0]),
    }).then(pipe([
      () => this.docker.pushImage(this.name, repository, pick([
        'username',
        'password',
        'email',
        'serveraddress',
        'identitytoken',
      ])(options)),
      response => {
        response.body.on('end', thunkify(resolve, result))
        response.body.on('error', reject)
        response.body.pipe(result)
      },
    ]))
  })
  return result
}

/**
 * @name DockerImage.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name, dockerfile).inspect() -> {}
 * ```
 */
DockerImage.prototype.inspect = function () {
  return this.docker.inspectImage(this.name).then(pipe([
    get('body'),
    passthrough(''),
    parseJSON,
  ]))
}

module.exports = DockerImage
