const ReadStream = {}

/**
 * @name ReadStream.Buffer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.Buffer(readable stream.Readable) -> Promise<Buffer>
 * ```
 *
 * ```javascript
 * const buffer = await ReadStream.Buffer(readable)
 * ```
 */
ReadStream.Buffer = function ReadStreamBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', chunk => {
      chunks.push(chunk)
    })
    readable.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    readable.on('error', reject)
  })
}

/**
 * @name ReadStream.Text
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.Text(readable stream.Readable) -> Promise<string>
 * ```
 *
 * ```javascript
 * const text = await ReadStream.Text(readable)
 * ```
 */
ReadStream.Text = function ReadStreamText(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', chunk => {
      chunks.push(chunk)
    })
    readable.on('end', () => {
      resolve(chunks.map(chunk => chunk.toString('utf8')).join(''))
    })
    readable.on('error', reject)
  })
}

/**
 * @name ReadStream.JSON
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.JSON(readable stream.Readable) -> Promise<object>
 * ```
 *
 * ```javascript
 * const data = await ReadStream.JSON(readable)
 * ```
 */
ReadStream.JSON = function ReadStreamJSON(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', chunk => {
      chunks.push(chunk)
    })
    readable.on('end', () => {
      try {
        resolve(JSON.parse(chunks.map(chunk => chunk.toString('utf8')).join('')))
      } catch (error) {
        reject(error)
      }
    })
    readable.on('error', reject)
  })
}

module.exports = ReadStream
