const fs = require('fs')

const DATA_SLICE_SIZE = 512 * 1024

const ENCODING = 'utf8'

/**
 * @name DiskLinkedHashTable
 *
 * @docs
 * ```coffeescript [specscript]
 * new DiskLinkedHashTable(options {
 *   length: number,
 *   filepath: string,
 *   sortValueType: 'string'|'number',
 *   sortValueResolver (value string)=>(sortValue string|number),
 * }) -> DiskLinkedHashTable
 * ```
 */
class DiskLinkedHashTable {
  constructor(options) {
    this.length = options.length
    this.filepath = options.filepath
    this.sortValueType = options.sortValueType
    this.sortValueResolver = options.sortValueResolver
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
    const keyBuffer = readBuffer.subarray(20, keyByteLength + 20)
    return keyBuffer.toString(ENCODING)
  }

  /**
   * @name set
   *
   * @docs
   * ```coffeescript [specscript]
   * set(
   *   key string,
   *   value string,
   *   sortValue string|number
   * ) -> Promise<>
   * ```
   */
  async set(key, value, sortValue) {
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

    let forwardIndex = -1
    let reverseIndex = -1
    // TODO

    const position = index * DATA_SLICE_SIZE
    const buffer = Buffer.alloc(DATA_SLICE_SIZE)
    const sortValueString = typeof sortValue == 'string' ? sortValue : sortValue.toString()

    // first 32 bits / 4 bytes for key size
    // second 32 bits / 4 bytes for sort value size
    // third 32 bits / 4 bytes for value size
    // fourth 32 bits / 4 bytes for forward index
    // fifth 32 bits / 4 bytes for reverse index
    // next chunk for key
    // next chunk for sort value
    // remainder for value
    const keyByteLength = Buffer.byteLength(key, ENCODING)
    const sortValueByteLength = Buffer.byteLength(sortValueString, ENCODING)
    const valueByteLength = Buffer.byteLength(value, ENCODING)
    buffer.writeUint32BE(keyByteLength, 0)
    buffer.writeUint32BE(sortValueByteLength, 4)
    buffer.writeUint32BE(valueByteLength, 8)
    buffer.writeInt32BE(forwardIndex, 12)
    buffer.writeInt32BE(reverseIndex, 16)
    buffer.write(key, 20, keyByteLength, ENCODING)
    buffer.write(sortValueString, 20 + keyByteLength, sortValueByteLength, ENCODING)
    buffer.write(value, 20 + keyByteLength + sortValueByteLength, valueByteLength, ENCODING)

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
    const sortValueByteLength = readBuffer.readUInt32BE(4)
    const valueByteLength = readBuffer.readUInt32BE(8)
    const valueBuffer = readBuffer.subarray(
      20 + keyByteLength + sortValueByteLength,
      20 + keyByteLength + sortValueByteLength + valueByteLength
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

module.exports = DiskLinkedHashTable
