const HttpServer = require('./HttpServer')
const WebSocket = require('ws')
const noop = require('rubico/x/noop')

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
 * }).listen(1337, () => {
 *   console.log('WebSocket server listening on port 1337')
 * })
 * ```
 */

const WebSocketServer = function (
  socketHandler, httpHandler = healthyHttpHandler
) {
  const httpServer = new HttpServer(httpHandler)
  const webSocketServer = new WebSocket.Server({ server: httpServer })
  webSocketServer.on('connection', socketHandler.bind(webSocketServer))
  webSocketServer.on('close', function closeHttpServer() {
    httpServer.close()
  })
  webSocketServer.listen = (...args) => httpServer.listen(...args)
  webSocketServer.detectAndCloseBrokenConnections = (options = {}) => {
    const { pingInterval = 30000 } = options
    webSocketServer.on('connection', function (websocket) {
      websocket.isAlive = true
      websocket.on('pong', function heartbeat() {
        websocket.isAlive = true
      })
    })

    const interval = setInterval(function pingConnectedWebSockets() {
      webSocketServer.clients.forEach(function ping(websocket) {
        if (websocket.isAlive) {
          websocket.isAlive = false
          websocket.ping(noop)
        } else {
          websocket.terminate()
        }
      })
    }, pingInterval)
    webSocketServer.on('close', function cleanupInterval() {
      clearInterval(interval)
    })
  }
  return webSocketServer
}

module.exports = WebSocketServer
