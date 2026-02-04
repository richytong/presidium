/**
 * @name Readable
 *
 * @docs
 * Presidium Readable class. Contains methods for reading [Node.js stream.Readable](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) objects.
 */
const Readable = {}

/**
 * @name Readable.Buffer
 *
 * @docs
 * ```coffeescript [specscript]
 * module stream 'https://nodejs.org/docs/latest-v24.x/api/stream.html'
 *
 * Readable.Buffer(readable stream.Readable) -> buffer Promise<Buffer>
 * ```
 *
 * Reads a [Node.js stream.Readable](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) object into a [Node.js Buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html).
 *
 * Arguments:
 *   * `readable` - [`stream.Readable`](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) - a Node.js readable stream.
 *
 * Return:
 *   * `buffer` - a promise of a Node.js Buffer object.
 *
 * ```javascript
 * const myFile = fs.createReadStream('my-file')
 *
 * const myFileBuffer = await Readable.Buffer(myFile)
 *
 * const myFileContents = myFileBuffer.toString('utf8')
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
 * module stream 'https://nodejs.org/docs/latest-v24.x/api/stream.html'
 *
 * Readable.Text(readable stream.Readable) -> text Promise<string>
 * ```
 *
 * Reads a [Node.js stream.Readable](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) object into a utf-8 encoded string.
 *
 * Arguments:
 *   * `readable` - [`stream.Readable`](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) - a Node.js readable stream.
 *
 * Return:
 *   * `text` - a promise of the data of the Node.js readable stream as a utf-8 encoded string.
 *
 * ```javascript
 * const myFile = fs.createReadStream('my-file')
 *
 * const myFileContents = await Readable.Text(myFile)
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
 * module stream 'https://nodejs.org/docs/latest-v24.x/api/stream.html'
 *
 * Readable.JSON(readable stream.Readable) -> data Promise<object>
 * ```
 *
 * Reads a [Node.js stream.Readable](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) object into a JSON object.
 *
 * Arguments:
 *   * `readable` - [`stream.Readable`](https://nodejs.org/docs/latest-v24.x/api/stream.html#class-streamreadable) - a Node.js readable stream.
 *
 * Return:
 *   * `data` - a promise of the data of the Node.js readable stream as a JSON object.
 *
 * ```javascript
 * const response = await HTTP.get('https://jsonplaceholder.typicode.com/todos/1')
 * const data = await Readable.JSON(response)
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
