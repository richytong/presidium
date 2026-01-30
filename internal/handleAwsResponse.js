const Readable = require('../Readable')
const AwsError = require('./AwsError')

/**
 * @name handleAwsResponse
 *
 * @docs
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/api/http.html'
 *
 * handleAwsResponse(
 *   response http.ServerResponse,
 *   method function,
 *   ...args Array
 * ) -> Promise
 * ```
 */
async function handleAwsResponse(response, method, ...args) {
  if (response.ok) {
    const data = await Readable.JSON(response)
    return data
  }
  const error = new AwsError(await Readable.Text(response), response.status)
  if (retryableErrorNames.includes(error.name)) {
    await sleep(1000)
    return method.apply(this, args)
  }
  throw error
}

module.exports = handleAwsResponse
