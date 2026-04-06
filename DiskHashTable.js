const fs = require('fs')

const DATA_SLICE_SIZE = 512 * 1024

const ENCODING = 'utf8'

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

  // _hash1(key string) -> number
  _hash1(key) {
    let total = 0
    const WEIRD_PRIME = 31
    for (let i = 0; i < Math.min(key.length, 100); i++) {
      let char = key[i]
      let value = char.charCodeAt(0) - 96
      total = (total * WEIRD_PRIME + value) % this.length
    }
    return total
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
    const position = index * DATA_SLICE_SIZE

    const readBuffer = Buffer.alloc(DATA_SLICE_SIZE)

    const { bytesRead } = await this.fd.read({
      buffer: readBuffer,
      offset: 0,
      position,
      length: DATA_SLICE_SIZE,
    })

    if (bytesRead == 0) {
      return undefined
    }

    const keyByteLength = readBuffer.readUInt32BE(0)
    const keyBuffer = readBuffer.subarray(8, keyByteLength + 8)
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

    // first 32 bits / 4 bytes for key size
    // second 32 bits / 4 bytes for value size
    // next chunk key
    // remainder for json data
    const keyByteLength = Buffer.byteLength(key, ENCODING)
    const valueByteLength = Buffer.byteLength(value, ENCODING)
    buffer.writeUint32BE(keyByteLength, 0)
    buffer.writeUint32BE(valueByteLength, 4)
    buffer.write(key, 8, keyByteLength, ENCODING)
    buffer.write(value, keyByteLength + 8, valueByteLength, ENCODING)

    await this.fd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // get(key string) -> value Promise<string>
  async get(key) {
    let index = this._hash1(key)

    const position = index * DATA_SLICE_SIZE

    const readBuffer = Buffer.alloc(DATA_SLICE_SIZE)

    const { bytesRead } = await this.fd.read({
      buffer: readBuffer,
      offset: 0,
      position,
      length: DATA_SLICE_SIZE,
    })

    if (bytesRead == 0) {
      return undefined
    }

    const keyByteLength = readBuffer.readUInt32BE(0)
    const valueByteLength = readBuffer.readUInt32BE(4)
    const keyBuffer = readBuffer.subarray(8, keyByteLength + 8)
    const valueBuffer = readBuffer.subarray(keyByteLength + 8, valueByteLength + keyByteLength + 8)
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
