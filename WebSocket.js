const _WebSocket = require('ws')

/**
 * @name WebSocket
 *
 * @synopsis
 * ```coffeescript [specscript]
 * WebSocket(url string, protocols? Array<string>) -> WebSocket
 * ```
 *
 * @description
 * Creates a [ws WebSocket](https://github.com/websockets/ws/blob/master/lib/websocket.js)
 *
 * ```javascript
 * const socket = WebSocket('ws://localhost:1337/')
 *
 * socket.on('open', function open() {
 *   socket.send('something')
 * })
 *
 * socket.on('message', function incoming(data) {
 *   console.log(data)
 * })
 * ```
 */
const WebSocket = function (url, protocols) {
  return new _WebSocket(url, protocols)
}

module.exports = WebSocket
