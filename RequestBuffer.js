/**
 * @name RequestBuffer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RequestBuffer(request Request) -> Promise<Buffer>
 * ```
 */
const RequestBuffer = function (request) {
  return new Promise(resolve => {
    const binaryArray = []
    request.on('data', chunk => {
      binaryArray.push(chunk)
    })
    request.on('end', () => {
      resolve(Buffer.from(binaryArray))
    })
  })
}

module.exports = RequestBuffer
