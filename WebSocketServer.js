const HttpServer = require('./HttpServer')
const WebSocket = require('ws')

/**
 * @name healthyHttpHandler
 *
 * @synopsis
 * ```coffeescript [specscript]
 * healthyHttpHandler(
 *   request IncomingMessage,
 *   response ServerResponse,
 * )=>Promise<>|(),
 * ```
 */
const healthyHttpHandler = function (request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/plain',
  })
  response.end('ok')
}

/**
 * @name WebSocketServer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * WebSocketServer(
 *   socketHandler (socket engine.Socket)=>Promise<>|(),
 * ) -> server WebSocketServer
 * ```
 *
 * @description
 * Creates a WebSocketServer. Sockets are [engine.Socket](https://github.com/socketio/engine.io/blob/master/lib/socket.js)
 *
 * ```javascript
 * new WebSocketServer(socket => {
 *   socket.on('message', message => {
 *     console.log('Got message:', message)
 *   })
 *   socket.on('close', () => {
 *     console.log('Socket closed')
 *   })
 * })
 * ```
 */

const WebSocketServer = function (
  socketHandler, httpHandler = healthyHttpHandler
) {
  const httpServer = new HttpServer(httpHandler)
  const webSocketServer = new WebSocket.Server({ server: httpServer })
  webSocketServer.on('connection', socketHandler)
  return httpServer
}

module.exports = WebSocketServer
