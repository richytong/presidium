const http = require('http')

/**
 * @name HttpAgent
 *
 * @synopsis
 * ```coffeescript [specscript]
 * HttpAgent(options {}) -> HttpAgent
 * ```
 */
const HttpAgent = function (options) {
  return new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: Infinity,
    ...options
  })
}

module.exports = HttpAgent
