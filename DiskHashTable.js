const fs = require('fs')

const DATA_SLICE_SIZE = 512 * 1024

const ENCODING = 'utf8'

const EMPTY = 0
const OCCUPIED = 1
const REMOVED = 2

/**
 * @name DiskHashTable
 *
 * @docs
 * ```coffeescript [specscript]
 * new DiskHashTable(options {
 *   length: number,
 *   filepath: string,
 * }) -> DiskHashTable
 * ```
 */
class DiskHashTable {
  constructor(options) {
    this.length = options.length
    this.filepath = options.filepath
    this.fd = null
  }

  // init() -> Promise<>
  async init() {
    const dir = this.filepath.split('/').slice(0, -1).join('/')
    await fs.promises.mkdir(dir, { recursive: true })

    const now = new Date()
    try {
      fs.utimesSync(this.filepath, now, now)
    } catch (error) {
      fs.closeSync(fs.openSync(this.filepath, 'a'))
    }

    this.fd = await fs.promises.open(this.filepath, 'r+')
  }

  // clear() -> Promise<>
  async clear() {
    await fs.promises.rm(this.filepath).catch(() => {})
  }

  close() {
    this.fd.close()
  }

  // _hash1(key string) -> number
  _hash1(key) {
    let hashCode = 0
    const prime = 31
    for (let i = 0; i < key.length; i++) {
      hashCode = (prime * hashCode + key.charCodeAt(i)) % this.length
    }
    return hashCode
  }

  // _hash2(key string) -> number
  _hash2(key) {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 3) - hash + key.charCodeAt(i)
    }
    const prime = 7 
    return prime - (Math.abs(hash) % prime)
  }

  // _getKey(index number) -> key Promise<string>
  async _getKey(index) {
    if (index == -1) {
      throw new Error('Negative index')
    }

    const position = index * DATA_SLICE_SIZE

    const readBuffer = Buffer.alloc(DATA_SLICE_SIZE)

    await this.fd.read({
      buffer: readBuffer,
      offset: 0,
      position,
      length: DATA_SLICE_SIZE,
    })

    const statusMarker = readBuffer.readUInt8(0)
    if (statusMarker === EMPTY) {
      return undefined
    }

    const keyByteLength = readBuffer.readUInt32BE(1)
    const keyBuffer = readBuffer.subarray(9, keyByteLength + 9)
    return keyBuffer.toString(ENCODING)
  }

  // set(key string, value string) -> ()
  async set(key, value) {
    let index = this._hash1(key)

    const startIndex = index
    const stepSize = this._hash2(key)

    let currentKey = await this._getKey(index)
    while (currentKey) {
      if (key == currentKey) {
        break
      }

      index = (index + stepSize) % this.length
      if (index == startIndex) {
        throw new Error('Hash table is full')
      }

      currentKey = await this._getKey(index)
    }

    const position = index * DATA_SLICE_SIZE
    const buffer = Buffer.alloc(DATA_SLICE_SIZE)

    // 8 bits / 1 byte for status marker: 0 empty / 1 occupied / 2 deleted
    // 32 bits / 4 bytes for key size
    // 32 bits / 4 bytes for value size
    // chunk for key
    // remainder for value
    const statusMarker = 1
    const keyByteLength = Buffer.byteLength(key, ENCODING)
    const valueByteLength = Buffer.byteLength(value, ENCODING)
    buffer.writeUInt8(statusMarker, 0)
    buffer.writeUint32BE(keyByteLength, 1)
    buffer.writeUint32BE(valueByteLength, 5)
    buffer.write(key, 9, keyByteLength, ENCODING)
    buffer.write(value, keyByteLength + 9, valueByteLength, ENCODING)

    await this.fd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // get(key string) -> value Promise<string>
  async get(key) {
    let index = this._hash1(key)
    const startIndex = index
    const stepSize = this._hash2(key)

    let currentKey = await this._getKey(index)
    while (currentKey) {
      if (key == currentKey) {
        break
      }

      index = (index + stepSize) % this.length
      if (index == startIndex) {
        return undefined // entire table searched
      }

      currentKey = await this._getKey(index)
    }

    if (currentKey == null) {
      return undefined
    }

    const position = index * DATA_SLICE_SIZE

    const readBuffer = Buffer.alloc(DATA_SLICE_SIZE)

    await this.fd.read({
      buffer: readBuffer,
      offset: 0,
      position,
      length: DATA_SLICE_SIZE,
    })

    const statusMarker = readBuffer.readUInt8(0)
    // TODO handle status marker

    const keyByteLength = readBuffer.readUInt32BE(1)
    const valueByteLength = readBuffer.readUInt32BE(5)
    const keyBuffer = readBuffer.subarray(9, keyByteLength + 9)
    const valueBuffer = readBuffer.subarray(
      9 + keyByteLength,
      9 + keyByteLength + valueByteLength
    )
    return valueBuffer.toString(ENCODING)
  }

  /*
  async remove(key) {
    let index = this._hash1(key)
    if (this.keyMap[index]) {
      this.keyMap[index] = this.keyMap[index].filter(pair => pair[0] !== key)
    }
  }
  */

}

module.exports = DiskHashTable
