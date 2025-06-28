const ReadStream = {}

/**
 * @name ReadStream.buffer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.buffer(readable stream.Readable) -> Promise<Buffer>
 * ```
 *
 * ```javascript
 * const buffer = await ReadStream.buffer(readable)
 * ```
 */
ReadStream.buffer = function buffer(readable) {
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
 * @name ReadStream.text
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.text(readable stream.Readable) -> Promise<string>
 * ```
 *
 * ```javascript
 * const text = await ReadStream.text(readable)
 * ```
 */
ReadStream.text = function text(readable) {
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
 * @name ReadStream.json
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.json(readable stream.Readable) -> Promise<object>
 * ```
 *
 * ```javascript
 * const data = await ReadStream.json(readable)
 * ```
 */
ReadStream.json = function json(readable) {
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
