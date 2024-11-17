const http = require('http')
const zlib = require('zlib')
const isPromise = require('./internal/isPromise')
const StringStream = require('./StringStream')

/**
 * @name HttpServer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * HttpServer(
 *   httpHandler (
 *     request http.IncomingMessage,
 *     response http.ServerResponse,
 *   )=>Promise<>|(),
 * ) -> server HttpServer
 * ```
 *
 * @description
 * Creates an instance of a Node.js `http.Server` ([Node.js docs](https://nodejs.org/api/net.html#net_class_net_server))
 *
 * ```javascript
 * const requestBodyToString = request => new Promise((resolve, reject) => {
 *   let body = []
 *   request.on('data', chunk => {
 *     body.push(chunk)
 *   }).on('end', () => {
 *     body = Buffer.concat(body).toString()
 *     resolve(body)
 *   }).on('error', reject)
 * })
 *
 * HttpServer(async (request, response) => {
 *   request.startTime = Date.now()
 *   switch (request.path) {
 *     case '/':
 *       response.writeHead(200, {
 *         'Content-Type': 'application/json',
 *         'X-Powered-By': 'presidium',
 *       })
 *       response.write(JSON.stringify({ greeting: 'Hello World' }))
 *     case '/echo':
 *       response.writeHead(200, {
 *         'Content-Type': 'text/plain',
 *         'X-Powered-By': 'presidium',
 *       })
 *       response.write(await requestBodyToString(request))
 *     default:
 *       response.writeHead(404, {
 *         'Content-Type': 'text/html',
 *         'X-Powered-By': 'presidium',
 *       })
 *       response.write('<p>Not Found</p>')
 *   }
 *   response.end()
 *   console.log(`${request.method} ${request.path} complete in ${Date.now() - request.startTime}`)
 * }).on('connection', socket => {}).listen(3000)
 * ```
 */
const HttpServer = function (httpHandler) {
  return http.createServer(httpHandler)
}

module.exports = HttpServer
