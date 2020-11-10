const fetch = require('node-fetch')

/**
 * @name Http
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Http(url string) -> http
 * ```
 *
 * @description
 * The Hypertext Transfer Protocol. [wikipedia](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol)
 */
const Http = function (url) {
  if (this == null || this.constructor != Http) {
    return new Http(url)
  }
  this.url = url
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
 *
 * @todo CONNECT
 */
Http.prototype.get = function (path, options) {
  return fetch(new URL(path, this.url), options)
}

Http.prototype.head = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'HEAD', ...options })
}

Http.prototype.post = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'POST', ...options })
}

Http.prototype.put = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'PUT', ...options })
}

Http.prototype.delete = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'DELETE', ...options })
}

Http.prototype.options = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'OPTIONS', ...options })
}

Http.prototype.trace = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'TRACE', ...options })
}

Http.prototype.patch = function (path, options) {
  return fetch(new URL(path, this.url), { method: 'PATCH', ...options })
}

module.exports = Http
