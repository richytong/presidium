const http = require('http')
const https = require('https')

/**
 * @name httpConfigure
 *
 * @docs
 * ```coffeescript [specscript]
 * type RequestOptions = {
 *   agent: http.Agent,
 *   auth: string,
 *   createConnection: function,
 *   defaultPort: number,
 *   family: number,
 *   headers: object,
 *   hints: number,
 *   host: string,
 *   hostname: string,
 *   insecureHTTPParser: boolean,
 *   joinDuplicateHeaders: boolean,
 *   localAddress: string,
 *   localPort: number,
 *   lookup: function,
 *   maxHeaderSize: number,
 *   method: string,
 *   path: string,
 *   port: number,
 *   protocol: string,
 *   setDefaultHeaders: boolean,
 *   setHost: boolean,
 *   signal: AbortSignal,
 *   socketPath: string,
 *   timeout: number,
 *   uniqueHeaders: Array<string>,
 * }
 *
 * httpConfigure(baseUrl string|URL, requestOptions RequestOptions) -> undefined
 * ```
 */
function httpConfigure(baseUrl, requestOptions) {
  if (typeof baseUrl == 'string') {
    this.baseUrl = new URL(baseUrl)
  }
  else if (typeof baseUrl?.toString == 'function') {
    this.baseUrl = new URL(baseUrl)
  }
  else if (baseUrl?.constructor == URL) {
    this.baseUrl = baseUrl
  }
  else {
    throw new TypeError('Invalid baseUrl')
  }

  this.client = this.baseUrl.protocol == 'https:' ? https : http

  this.requestOptions = {
    hostname: this.baseUrl.hostname,
    protocol: this.baseUrl.protocol,
    ...requestOptions,
  }

  this.requestHeaders = {}

  if (this.baseUrl.username && this.baseUrl.password) {
    const { username, password } = this.baseUrl
    const credentials = `${username}:${password}`
    const encodedCredentials = Buffer.from(credentials).toString('base64')
    this.requestHeaders['Authorization'] = `Basic ${encodedCredentials}`
  }
}

module.exports = httpConfigure
