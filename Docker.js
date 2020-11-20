const Http = require('./Http')
const HttpAgent = require('./HttpAgent')
const querystring = require('querystring')
const pipe = require('rubico/pipe')
const pick = require('rubico/pick')
const switchCase = require('rubico/switchCase')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const stringifyJSON = require('./internal/stringifyJSON')

/**
 * @name Docker
 *
 * @synopsis
 * new Docker() -> Docker
 */
const Docker = function () {
  if (this == null || this.constructor != Docker) {
    return new Docker()
  }
  const agent = new HttpAgent({
    socketPath: '/var/run/docker.sock',
  })
  this.http = new Http('http://0.0.0.0/v1.40', { agent })
  return this
}

/**
 * @name Docker.prototype.listImages
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().listImages() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.listImages = function dockerListImages() {
  return this.http.get('/images/json')
}

/**
 * @name Docker.prototype.auth
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().auth({
 *   username: string,
 *   password: string,
 *   email: string,
 *   serveraddress: string, // domain/IP without a protocol
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.auth = function dockerAuth(authorization) {
  return this.http.post('auth', {
    body: switchCase([
      isString,
      identity,
      pipe([
        pick(['username', 'password', 'email', 'serveraddress']),
        stringifyJSON,
      ]),
    ])(authorization)
  })
}

/**
 * @name Docker.prototype.inspectImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().inspectImage(name string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspectImage = function dockerInspectImage(name) {
  return this.http.get(`/images/${name}/json`)
}

/**
 * @name Docker.prototype.tagImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().tagImage(
 *   name string,
 *   options {
 *     repo: string, // some_user/some_image
 *     tag: string,
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.tagImage = function dockerTagImage(name, options) {
  return this.http.post(`/images/${name}/tag?${
    querystring.stringify(pick(['repo', 'tag'])(options))
  }`)
}

/**
 * @name Docker.prototype.removeImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().removeImage(name string, options? {
 *   force: boolean,
 *   noprune: boolean, // do not delete untagged parent images
 * }) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * `name` is a docker image name or ID
 */
Docker.prototype.removeImage = function dockerRemoveImage(name, options) {
  return this.http.delete(`/images/${name}?${
    querystring.stringify(pick(['force', 'noprune'])(options))
  }`)
}

module.exports = Docker
