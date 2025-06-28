const http = require('http')
const https = require('https')
const path = require('path')

/**
 * @name Http
 */
class Http {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.client = baseUrl.includes('https') ? https : http
  }

  /**
   * @name request
   *
   * @synopsis
   * ```coffeescript [specscript]
   * request(options {
   *   hostname: string,
   *   port: number,
   *   path: string,
   *   method: string,
   *   headers: object,
   *   body: Buffer|TypedArray|string,
   * }) -> Promise<response http.ServerResponse>
   * ```
   */
  request(options) {
    const { body, ...requestOptions } = options
    return new Promise((resolve, reject) => {
      const request = this.client.request(requestOptions, response => {
        response.status = response.statusCode

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

      request.on('error', reject)
      request.end(body)
    })
  }

  get(relativeUrl, options = {}) {
    console.log('get', relativeUrl, options)
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: options.headers ?? {},
      body: options.body,
    }
    return this.request(requestOptions)
  }

  head(relativeUrl, options = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'HEAD',
      headers: options.headers ?? {},
      body: options.body,
    }
    return this.request(requestOptions)
  }

  post(relativeUrl, options = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: options.headers ?? {},
      body: options.body,
    }
    return this.request(requestOptions)
  }

  put(relativeUrl, options = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'PUT',
      headers: options.headers ?? {},
      body: options.body,
    }
    return this.request(requestOptions)
  }

  patch(relativeUrl, options = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'PATCH',
      headers: options.headers ?? {},
      body: options.body,
    }
    return this.request(requestOptions)
  }

  delete(relativeUrl, options = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'DELETE',
      headers: options.headers ?? {},
      body: options.body
    }
    return this.request(requestOptions)
  }

  connect(options = {}) {
    const parsedUrl = new URL(this.baseUrl)
    const requestOptions = {
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port),
      method: 'CONNECT',
      path: options.path,
    }
    const request = this.client.request(requestOptions)
    request.end(options.body)
    return request
  }

  options(relativeUrl, options2 = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'OPTIONS',
      headers: options2.headers ?? {},
      body: options2.body,
    }
    return this.request(requestOptions)
  }

  trace(relativeUrl, options = {}) {
    const url = path.join(this.baseUrl, relativeUrl)
    const parsedUrl = new URL(url)
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'TRACE',
      headers: options.headers ?? {},
      body: options.body,
    }
    return this.request(requestOptions)
  }
}

module.exports = Http
