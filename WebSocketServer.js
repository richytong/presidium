const HttpServer = require('./HttpServer')
const WebSocket = require('ws')

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
 * WebSocketServer(async socket => {
 *   socket.on('message', message => {})
 *   socket.on('close', () => {})
 * })
 * ```
 */

const WebSocketServer = function (socketHandler) {
  if (this == null || this.constructor != WebSocketServer) {
    return new WebSocketServer(socketHandler)
  }
  const httpServer = new HttpServer(),
    webSocketServer = new WebSocket.Server({ server: httpServer })
  webSocketServer.on('connection', socketHandler)
  this.httpServer = httpServer
  this.webSocketServer = webSocketServer
  return this
}

/**
 * @name WebSocketServer.prototype.listen
 *
 * @synopsis
 * ```coffeescript [specscript]
 * WebSocketServer(socketHandler).listen(port number, callback function) -> WebSocketServer
 * ```
 */
WebSocketServer.prototype.listen = function listen(port, callback) {
  this.httpServer.listen(port, callback)
  return this
}

/**
 * @name WebSocketServer.prototype.close
 *
 * @synopsis
 * ```coffeescript [specscript]
 * WebSocketServer(socketHandler).close(callback function) -> WebSocketServer
 * ```
 */
WebSocketServer.prototype.close = function close(callback) {
  this.httpServer.close(callback)
  return this
}

module.exports = WebSocketServer
