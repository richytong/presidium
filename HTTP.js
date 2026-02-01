const http = require('http')
const https = require('https')
const path = require('path')
const stream = require('stream')

/**
 * @name HTTP
 *
 * @docs
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/api/http.html'
 *
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
 * new HTTP(baseUrl string, requestOptions) -> http HTTP
 * new HTTP(requestOptions) -> http HTTP
 * ```
 */
class HTTP {
  constructor(baseUrl, requestOptions = {}) {
    if (typeof baseUrl == 'string') {
      this.baseUrl = new URL(baseUrl)
    }
    else if (baseUrl == null) {
      throw new TypeError('baseUrl invalid')
    }
    else if (typeof baseUrl.toString == 'function') {
      this.baseUrl = new URL(baseUrl)
    }
    else if (baseUrl.constructor == URL) {
      this.baseUrl = baseUrl
    } else {
      throw new TypeError('baseUrl invalid')
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

    this._sockets = new Set()
  }

  /**
   * @name request
   *
   * @docs
   * ```coffeescript [specscript]
   * request(options {
   *   hostname: string,
   *   port: number,
   *   path: string,
   *   method: string,
   *   headers: object,
   *   body: Buffer|TypedArray|string,
   * }) -> response Promise<http.ServerResponse>
   * ```
   */
  request(options) {
    const { body, ...requestOptions } = options
    return new Promise((resolve, reject) => {
      const request = this.client.request(requestOptions, response => {
        response.status = response.statusCode
        response.ok = response.statusCode >= 200 && response.statusCode <= 299

        const chunks = []

        response.buffer = () => new Promise((resolve2, reject2) => {
          if (response.ended) {
            resolve2(new Uint8Array(Buffer.concat(chunks)))
          } else {
            response.on('data', chunk => {
              chunks.push(chunk)
            })
            response.on('end', () => {
              response.ended = true
              resolve2(Buffer.concat(chunks))
            })
            response.on('error', reject2)
          }
        })

        response.text = () => new Promise((resolve2, reject2) => {
          if (response.ended) {
            resolve2(chunks.map(chunk => chunk.toString('utf8')).join(''))
          } else {
            response.on('data', chunk => {
              chunks.push(chunk)
            })
            response.on('end', () => {
              response.ended = true
              resolve2(chunks.map(chunk => chunk.toString('utf8')).join(''))
            })
            response.on('error', reject2)
          }
        })

        response.json = () => new Promise((resolve2, reject2) => {
          if (response.ended) {
            try {
              resolve2(JSON.parse(chunks.map(chunk => chunk.toString('utf8')).join('')))
            } catch (error) {
              reject2(error)
            }
          } else {
            response.on('data', chunk => {
              chunks.push(chunk)
            })
            response.on('end', () => {
              response.ended = true
              try {
                resolve2(JSON.parse(chunks.map(chunk => chunk.toString('utf8')).join('')))
              } catch (error) {
                reject2(error)
              }
            })
            response.on('error', reject2)
          }
        })

        resolve(response)
      })

      request.on('socket', socket => {
        this._sockets.add(socket)
      })

      request.on('error', reject)
      if (
        Buffer.isBuffer(body)
        || ArrayBuffer.isView(body)
      ) {
        request.end(body)
      } else if (typeof body == 'string') {
        request.end(Buffer.from(body, 'utf8'))
      }
      else if (stream.isReadable(body)) {
        body.pipe(request)
      } else if (body == null) {
        request.end()
      } else if (typeof body.toString == 'function') {
        request.end(body.toString())
      }
      else {
        console.error(body)
        throw new TypeError('body must be one of Buffer, TypedArray, or string')
      }
    })
  }

  get(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'GET',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  GET(...args) {
    return this.get(...args)
  }

  head(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'HEAD',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  HEAD(...args) {
    return this.head(...args)
  }

  post(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'POST',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  POST(...args) {
    return this.post(...args)
  }

  put(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'PUT',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  PUT(...args) {
    return this.put(...args)
  }

  patch(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'PATCH',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  PATCH(...args) {
    return this.patch(...args)
  }

  delete(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'DELETE',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  DELETE(...args) {
    return this.delete(...args)
  }

  connect(options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      host: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: Number(this.baseUrl.port),
      method: 'CONNECT',
      path: options.path,
    }
    const request = this.client.request(requestOptions)
    request.end(options.body)
    return request
  }

  CONNECT(...args) {
    return this.connect(...args)
  }

  options(relativeUrl, options2 = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'OPTIONS',
      headers: {
        ...this.requestHeaders,
        ...options2.headers
      },
      body: options2.body,
    }
    return this.request(requestOptions)
  }

  OPTIONS(...args) {
    return this.options(...args)
  }

  trace(relativeUrl, options = {}) {
    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method: 'TRACE',
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  TRACE(...args) {
    return this.trace(...args)
  }

  /**
   * @name closeConnections
   *
   * @docs
   * ```coffeescript [specscript]
   * http.closeConnections() -> ()
   * ```
   */
  closeConnections() {
    this._sockets.forEach(socket => {
      socket.destroy()
    })
  }
}

HTTP.Server = (...args) => http.createServer(...args)
HTTP.SecureServer = (...args) => https.createServer(...args)

module.exports = HTTP
