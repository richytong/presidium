const curry = require('rubico/curry')
const __ = require('rubico/__')
const engine = require('engine.io')
const EventEmitter = require('events')
const HttpServer = require('./HttpServer')

// (
//   engineServer engine.Server,
//   request http.IncomingMessage,
//   response http.ServerResponse
// ) => ()
const engineServerHandleRequest = (
  engineServer, request, response,
) => engineServer.handleUpgrade(request, response)

// (
//   engineServer engine.Server,
//   request http.IncomingMessage,
//   socket stream.Duplex,
//   head Buffer,
// ) => ()
const engineServerHandleUpgrade = (
  engineServer, request, socket, head,
) => engineServer.handleUpgrade(request, socket, head)

/**
 * @name SocketServer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * SocketServer(
 *   socketHandler (socket engine.Socket)=>Promise<>|(),
 * ) -> server SocketServer
 * ```
 *
 * @description
 * Creates a SocketServer. Sockets are [engine.Socket](https://github.com/socketio/engine.io/blob/master/lib/socket.js)
 *
 * ```javascript
 * SocketServer(async socket => {
 *   socket.on('message', message => {})
 *   socket.on('close', () => {})
 * })
 * ```
 */

const SocketServer = function (socketHandler) {
  if (this == null || this.constructor != SocketServer) {
    return new SocketServer(socketHandler)
  }
  EventEmitter.call(this)
  const httpServer = new HttpServer(),
    engineServer = new engine.Server()

  httpServer.on('request', curry.arity(3, engineServerHandleRequest, engineServer))
  httpServer.on('upgrade', curry.arity(4, engineServerHandleUpgrade, engineServer))
  engineServer.on('connection', socketHandler)
  this.httpServer = httpServer
  this.engineServer = engineServer
}

SocketServer.prototype.listen = function listen(port, callback) {
  this.httpServer.listen(port, callback)
  return this
}

SocketServer.prototype.close = function close(callback) {
  this.httpServer.close(callback)
  return this
}

module.exports = SocketServer
