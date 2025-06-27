const http = require('http')
const https = require('https')
const ws = require('ws')

/**
 * @name defaultHttpHandler
 *
 * @synopsis
 * ```coffeescript [specscript]
 * defaultHttpHandler(
 *   request IncomingMessage,
 *   response ServerResponse,
 * )=>Promise<>|(),
 * ```
 */
function defaultHttpHandler(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/plain',
  })
  response.end('OK')
}

/**
 * @name WebSocketServer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module ws
 * module http
 *
 * new WebSocketServer() -> server WebSocketServer
 *
 * new WebSocketServer(wsHandler ws.WebSocket=>()) -> server WebSocketServer
 *
 * new WebSocketServer(wsHandler ws.WebSocket=>(), options {
 *   httpHandler: (request http.ClientRequest, response http.ServerResponse)=>(),
 *   ssl: boolean,
 *   key: string,
 *   cert: string,
 * }) -> server WebSocketServer
 *
 * server.listen(port number, callback? function) -> ()
 * server.close() -> ()
 *
 * server.on('connection', wsHandler ws.WebSocket=>()) -> ()
 * ```
 *
 * @description
 * Server for the [WebSocket protocol](https://datatracker.ietf.org/doc/html/rfc6455).
 *
 * ```javascript
 * const server = new WebSocketServer(socket => {
 *   socket.on('message', message => {
 *     console.log('Got message:', message)
 *   })
 *   socket.on('close', () => {
 *     console.log('Socket closed')
 *   })
 * })
 *
 * server.listen(1337, () => {
 *   console.log('WebSocket server listening on port 1337')
 * })
 * ```
 */
class WebSocketServer {
  constructor(wsHandler, options = {}) {
    const { httpHandler = defaultHttpHandler, ssl, key, cert } = options

    this._httpServer = options.ssl
      ? https.createServer({ key, cert }, httpHandler)
      : http.createServer(httpHandler)

    this._wsServer = new ws.WebSocketServer({ server: this._httpServer })

    if (wsHandler) {
      this._wsServer.on('connection', wsHandler)
    }
  }

  get clients() {
    return this._wsServer.clients
  }

  listen(...args) {
    this._httpServer.listen(...args)
  }

  close() {
    this._httpServer.close()
    this._wsServer.close()
  }

  on(eventName, handler) {
    if (eventName == 'connection') {
      this._wsServer.on('connection', handler)
    } else if (eventName == 'close') {
      this._wsServer.on('close', handler)
    } else if (eventName == 'upgrade') {
      this._httpServer.on('upgrade', handler)
    } else if (eventName == 'request') {
      this._httpServer.on('request', handler)
    } else if (eventName == 'error') {
      this._wsServer.on('error', handler)
    } else {
      throw new Error(`Unrecognized event ${eventName}`)
    }
  }
}

module.exports = WebSocketServer
