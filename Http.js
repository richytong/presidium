const fetch = require('node-fetch')
const nodePath = require('path')
const get = require('rubico/get')

const pathJoin = nodePath.join

/**
 * @name Http
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Http(connection string) -> http
 * ```
 *
 * @description
 * The Hypertext Transfer Protocol. [wikipedia](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol)
 *
 * @todo
 * CONNECT method Http.prototype.connect
 * https://stackoverflow.com/questions/11697943/when-should-one-use-connect-and-get-http-methods-at-http-proxy-server/40329026
 */
const Http = function (connection, options) {
  if (this == null || this.constructor != Http) {
    return new Http(connection, options)
  }
  const url = new URL(connection)
  this.origin = get('origin')(url)
  this.basePath = get('pathname')(url)
  this.httpOptions = options
  return this
}

/**
 * @name Http.prototype.get
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Http(url).get(path string, options {
 *   body: string,
 *   headers: Object<string>,
 * }) -> Promise<Response>
 * ```
 *
 * @description
 * Makes an http GET request. [All options](https://github.com/node-fetch/node-fetch#options) from node-fetch.
 *
 * ```javascript
 * Http('https://google.com/').get('/')
 *   .then(res => res.text())
 *   .then(console.log)
 * ```
 *
 * [http method reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
 *
 * [Response reference](https://developer.mozilla.org/en-US/docs/Web/API/Response).
 */
Http.prototype.get = function httpGet(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
  })
}

Http.prototype.head = function httpHead(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'HEAD',
  })
}

Http.prototype.post = function httpPost(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'POST',
  })
}

Http.prototype.put = function httpPut(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'PUT',
  })
}

Http.prototype.delete = function httpDelete(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'DELETE',
  })
}

Http.prototype.options = function httpOptions(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'OPTIONS',
  })
}

Http.prototype.trace = function httpTrace(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'TRACE',
  })
}

Http.prototype.patch = function httpPatch(path, options) {
  return fetch(new URL(pathJoin(this.basePath, path), this.origin), {
    ...this.httpOptions,
    ...options,
    method: 'PATCH',
  })
}

module.exports = Http
