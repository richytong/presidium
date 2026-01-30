const Readable = require('../Readable')

/**
 * @name handleDockerHTTPResponse
 *
 * @docs
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/api/http.html'
 *
 * handleDockerHTTPResponse(response http.ServerResponse, options {
 *   stream: boolean,
 *   text: boolean,
 * })
 *   -> data Promise<Object>
 * ```
 */
async function handleDockerHTTPResponse(response, options = {}) {
  if (response.ok) {
    if (options.text) {
      const textData = await Readable.Text(response)
      return textData
    }
    if (options.stream) {
      return response
    }
    const data = await Readable.JSON(response)
    return data
  }
  const message = await Readable.Text(response)
  const error = new Error(message)
  error.code = response.status
  throw error
}

module.exports = handleDockerHTTPResponse
