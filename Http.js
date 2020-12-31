const fetch = require('node-fetch')
const nodePath = require('path')
const get = require('rubico/get')
const curry = require('rubico/curry')

const pathJoin = nodePath.join

/**
 * @name Http
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Http(url string|URL) -> http
 * ```
 *
 * @description
 * The Hypertext Transfer Protocol. [wikipedia](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol)
 *
 * @todo
 * CONNECT method Http.prototype.connect
 * https://stackoverflow.com/questions/11697943/when-should-one-use-connect-and-get-http-methods-at-http-proxy-server/40329026
 */
const Http = function (url, httpOptions) {
  if (this == null || this.constructor != Http) {
    return new Http(url)
  }
  const url = new URL(url)
  this.url = url
  this.httpOptions = httpOptions
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
  const url = new URL(this.url),
    pathUrl = new URL(`http://throwaway/${path}`)
  url.pathname = pathJoin(url.pathname, pathUrl.pathname)
  url.search = pathUrl.search
  return fetch(url, {
    ...this.httpOptions,
    ...options,
  })
}

// (method string, path string, options object) => Promise<HttpResponse>
const httpRequest = function httpRequest(method, path, options) {
  const url = new URL(this.url),
    pathUrl = new URL(`http://throwaway/${path}`)
  url.pathname = pathJoin(url.pathname, pathUrl.pathname)
  url.search = pathUrl.search
  return fetch(url, { ...this.httpOptions, ...options, method })
}

Http.prototype.head = function head(path, options) {
  return httpRequest.call(this, 'HEAD', path, options)
}

Http.prototype.post = function post(path, options) {
  return httpRequest.call(this, 'POST', path, options)
}

Http.prototype.put = function put(path, options) {
  return httpRequest.call(this, 'PUT', path, options)
}

Http.prototype.delete = function del(path, options) {
  return httpRequest.call(this, 'DELETE', path, options)
}

Http.prototype.options = function opts(path, options) {
  return httpRequest.call(this, 'OPTIONS', path, options)
}

Http.prototype.trace = function trace(path, options) {
  return httpRequest.call(this, 'TRACE', path, options)
}

Http.prototype.patch = function patch(path, options) {
  return httpRequest.call(this, 'PATCH', path, options)
}

module.exports = Http
