const https = require('https')

/**
 * @name HttpAgent
 *
 * @synopsis
 * ```coffeescript [specscript]
 * HttpAgent(options {}) -> HttpAgent
 * ```
 */
const HttpAgent = function (options) {
  return new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: Infinity,
    ...options
  })
}

module.exports = HttpAgent
