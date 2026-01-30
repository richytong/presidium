const Readable = {}

/**
 * @name Readable.Buffer
 *
 * @docs
 * ```coffeescript [specscript]
 * module stream
 *
 * Readable.Buffer(readable stream.Readable) -> Promise<Buffer>
 * ```
 *
 * ```javascript
 * const buffer = await Readable.Buffer(readable)
 * ```
 */
Readable.Buffer = function Readable(readable) {
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
 * @name Readable.Text
 *
 * @docs
 * ```coffeescript [specscript]
 * module stream
 *
 * Readable.Text(readable stream.Readable) -> Promise<string>
 * ```
 *
 * ```javascript
 * const text = await Readable.Text(readable)
 * ```
 */
Readable.Text = function Readable(readable) {
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
 * @name Readable.JSON
 *
 * @docs
 * ```coffeescript [specscript]
 * module stream
 *
 * Readable.JSON(readable stream.Readable) -> Promise<object>
 * ```
 *
 * ```javascript
 * const data = await Readable.JSON(readable)
 * ```
 */
Readable.JSON = function Readable(readable) {
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

module.exports = Readable
