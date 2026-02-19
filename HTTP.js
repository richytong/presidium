const http = require('http')
const https = require('https')
const path = require('path')
const stream = require('stream')
const httpConfigure = require('./internal/httpConfigure')

/**
 * @name HTTP
 *
 * @docs
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
 * new HTTP(baseUrl string, requestOptions RequestOptions) -> http HTTP
 * ```
 *
 * Presidium HTTP client.
 *
 * Arguments:
 *   * `baseUrl` - a full url that will act as the base url for future requests
 *   * `requestOptions` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to every request.
 *
 * Return:
 *   * `http` - an instance of the Presidium HTTP client.
 */
class HTTP {
  constructor(baseUrl, requestOptions = {}) {
    if (
      typeof baseUrl == 'string'
      || typeof baseUrl?.toString == 'function'
      || baseUrl?.constructor == URL
    ) {
      httpConfigure.call(this, baseUrl, requestOptions)
    } else {
      this.client = undefined
      this.requestOptions = {}
    }

    this._sockets = new Set()
  }

  request(options) {
    const { body, ...requestOptions } = options

    requestOptions.path = encodeURI(requestOptions.path)

    return new Promise((resolve, reject) => {
      const client = requestOptions.protocol == 'https:' ? https : http
      const request = client.request(requestOptions, response => {
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

  /**
   * @name _requestMethod
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * _requestMethod(
   *   method string,
   *   relativeUrl string,
   *   options RequestOptions
   * ) -> response http.ServerResponse
   * ```
   */
  _requestMethod(method, relativeUrl, options = {}) {
    if (relativeUrl.startsWith('http')) {
      const url_ = new URL(relativeUrl)
      const requestOptions = {
        hostname: url_.hostname,
        protocol: url_.protocol,
        port: url_.port,
        path: url_.pathname,
        method,
        headers: {
          ...options.headers,
        },
        body: options.body,
      }
      return this.request(requestOptions)
    }

    const requestOptions = {
      ...this.requestOptions,
      hostname: this.baseUrl.hostname,
      protocol: this.baseUrl.protocol,
      port: this.baseUrl.port,
      path: path.join(this.baseUrl.pathname, relativeUrl),
      method,
      headers: {
        ...this.requestHeaders,
        ...options.headers
      },
      body: options.body,
    }
    return this.request(requestOptions)
  }

  /**
   * @name get
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * get(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a GET request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.get('/todos/1')
   * ```
   */
  get(relativeUrl, options = {}) {
    return this._requestMethod('GET', relativeUrl, options)
  }

  /**
   * @name GET
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * GET(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a GET request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.GET('/todos/1')
   * ```
   */
  GET(relativeUrl, options = {}) {
    return this._requestMethod('GET', relativeUrl, options)
  }

  /**
   * @name head
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * head(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a HEAD request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.head('/todos/1')
   * ```
   */
  head(relativeUrl, options = {}) {
    return this._requestMethod('HEAD', relativeUrl, options)
  }

  /**
   * @name HEAD
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * HEAD(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a HEAD request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.HEAD('/todos/1')
   * ```
   */
  HEAD(relativeUrl, options = {}) {
    return this._requestMethod('HEAD', relativeUrl, options)
  }

  /**
   * @name post
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * post(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a POST request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.post('/todos/1')
   * ```
   */
  post(relativeUrl, options = {}) {
    return this._requestMethod('POST', relativeUrl, options)
  }

  /**
   * @name POST
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * POST(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a POST request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.POST('/todos/1')
   * ```
   */
  POST(relativeUrl, options = {}) {
    return this._requestMethod('POST', relativeUrl, options)
  }

  /**
   * @name put
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * put(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   * Makes a PUT request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.put('/todos/1')
   * ```
   */
  put(relativeUrl, options = {}) {
    return this._requestMethod('PUT', relativeUrl, options)
  }

  /**
   * @name PUT
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * PUT(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a PUT request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.PUT('/todos/1')
   * ```
   */
  PUT(relativeUrl, options = {}) {
    return this._requestMethod('PUT', relativeUrl, options)
  }

  /**
   * @name patch
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * patch(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a PATCH request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.patch('/todos/1')
   * ```
   */
  patch(relativeUrl, options = {}) {
    return this._requestMethod('PATCH', relativeUrl, options)
  }

  /**
   * @name PATCH
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * PATCH(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a PATCH request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.PATCH('/todos/1')
   * ```
   */
  PATCH(relativeUrl, options = {}) {
    return this._requestMethod('PATCH', relativeUrl, options)
  }

  /**
   * @name delete
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * delete(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a DELETE request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.delete('/todos/1')
   * ```
   */
  delete(relativeUrl, options = {}) {
    return this._requestMethod('DELETE', relativeUrl, options)
  }

  /**
   * @name DELETE
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * DELETE(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a DELETE request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.DELETE('/todos/1')
   * ```
   */
  DELETE(relativeUrl, options = {}) {
    return this._requestMethod('DELETE', relativeUrl, options)
  }

  /**
   * @name connect
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * connect(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a CONNECT request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.connect('/todos/1')
   * ```
   */
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

  /**
   * @name CONNECT
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * CONNECT(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a CONNECT request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.CONNECT('/todos/1')
   * ```
   */
  CONNECT(...args) {
    return this.connect(...args)
  }

  /**
   * @name options
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * options(relativeUrl string, requestOptions RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes an OPTIONS request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.options('/todos/1')
   * ```
   */
  options(relativeUrl, options2 = {}) {
    return this._requestMethod('OPTIONS', relativeUrl, options2)
  }

  /**
   * @name OPTIONS
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * OPTIONS(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes an OPTIONS request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.OPTIONS('/todos/1')
   * ```
   */
  OPTIONS(relativeUrl, options = {}) {
    return this._requestMethod('OPTIONS', relativeUrl, options)
  }

  /**
   * @name trace
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * trace(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a TRACE request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.trace('/todos/1')
   * ```
   */
  trace(relativeUrl, options = {}) {
    return this._requestMethod('TRACE', relativeUrl, options)
  }

  /**
   * @name TRACE
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/docs/latest-v24.x/api/http.html'
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
   * TRACE(relativeUrl string, options RequestOptions) -> response Promise<http.ServerResponse>
   * ```
   *
   * Makes a TRACE request.
   *
   * Arguments:
   *   * `relativeUrl` - the relative url that is appended to the base url to create the final url to request.
   *   * `options` - [`http.request(options)`](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequestoptions-callback) - options passed to the request.
   *
   * Return:
   *   * `response` - [`http.ServerResponse`](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse) - the response from the server.
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * const response = await http.TRACE('/todos/1')
   * ```
   */
  TRACE(relativeUrl, options = {}) {
    return this._requestMethod('TRACE', relativeUrl, options)
  }

  /**
   * @name closeConnections
   *
   * @docs
   * ```coffeescript [specscript]
   * http.closeConnections() -> undefined
   * ```
   *
   * Closes underlying TCP connections.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const http = new HTTP('https://jsonplaceholder.typicode.com/')
   *
   * // ...
   *
   * http.closeConnections()
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
