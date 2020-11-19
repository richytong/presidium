const Http = require('./Http')
const HttpAgent = require('./HttpAgent')
const querystring = require('querystring')
const pick = require('rubico/pick')

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
