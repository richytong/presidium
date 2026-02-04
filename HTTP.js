const http = require('http')
const https = require('https')
const path = require('path')
const stream = require('stream')

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
  GET(...args) {
    return this.get(...args)
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
  HEAD(...args) {
    return this.head(...args)
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
  POST(...args) {
    return this.post(...args)
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
  PUT(...args) {
    return this.put(...args)
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
  PATCH(...args) {
    return this.patch(...args)
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
  DELETE(...args) {
    return this.delete(...args)
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
  OPTIONS(...args) {
    return this.options(...args)
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
  TRACE(...args) {
    return this.trace(...args)
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
