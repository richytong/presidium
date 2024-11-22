const https = require('https')

/**
 * @name HttpsServer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * HttpsServer(
 *   httpHandler (
 *     request http.IncomingMessage,
 *     response http.ServerResponse,
 *   )=>Promise<>|(),
 *   options {
 *   },
 * ) -> server HttpsServer
 * ```
 *
 * @description
 * Creates an instance of a Node.js `https.Server` ([Node.js docs](https://nodejs.org/api/https.html#class-httpsserver))
 *
 */
const HttpsServer = function (options, httpHandler) {
  const server = https.createServer(options, httpHandler)

  server.ready = new Promise(resolve => {
    server._listeningResolve = resolve
  })
  const originalListen = server.listen
  server.listen = (...args) => {
    server._listeningResolve()
    return originalListen.apply(server, args)
  }

  return server
}

module.exports = HttpsServer
