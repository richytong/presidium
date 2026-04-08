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
 *   initialLength: number,
 *   storageFilepath: string,
 *   headerFilepath: string,
 *   resizeRatio: number,
 * }) -> ht DiskHashTable
 * ```
 *
 * Presidium DiskHashTable class. Creates a hash table that stores all data on disk.
 *
 * Arguments:
 *   * `options`
 *     * `initialLength` - `number` - the initial length of the disk hash table. Defaults to 1024.
 *     * `storageFilepath` - `string` - the path to the file used to store the disk hash table data.
 *     * `headerFilepath` - `string` - the path to the file used to store header information about the disk hash table.
 *     * `resizeRatio` - `number` - the ratio of number of items to table length at which to resize the table. Minimum value 0 (no resize), maximum value 1. Defaults to 0.
 *
 * Return:
 *   * `ht` - [`DiskHashTable`](/docs/DiskHashTable) - a `DiskHashTable` instance.
 *
 * ```javascript
 * const ht = new DiskHashTable({
 *   initialLength: 1024,
 *   filepath: '/path/to/data-file',
 * })
 * ```
 */
class DiskHashTable {
  constructor(options) {
    this.initialLength = options.initialLength ?? 1024
    this._length = null
    this._count = null
    this.storageFilepath = options.storageFilepath
    this.headerFilepath = options.headerFilepath
    this.storageFd = null
    this.headerFd = null
    this.resizeRatio = options.resizeRatio ?? 0
  }

  // _initializeHeader() -> headerReadBuffer Promise<Buffer>
  async _initializeHeader() {
    const headerReadBuffer = Buffer.alloc(8)
    headerReadBuffer.writeUInt32BE(this.initialLength, 0)
    headerReadBuffer.writeUInt32BE(0, 4)

    await this.headerFd.write(headerReadBuffer, {
      offset: 0,
      position: 0,
      length: headerReadBuffer.length,
    })

    return headerReadBuffer
  }

  /**
   * @name init
   *
   * @docs
   * ```coffeescript [specscript]
   * ht.init() -> Promise<>
   * ```
   *
   * Initializes the disk hash table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * Empty promise.
   *
   * ```javascript
   * await ht.init()
   * ```
   */
  async init() {
    for (const filepath of [this.storageFilepath, this.headerFilepath]) {
      const dir = filepath.split('/').slice(0, -1).join('/')
      await fs.promises.mkdir(dir, { recursive: true })

      const now = new Date()
      try {
        fs.utimesSync(filepath, now, now)
      } catch (error) {
        fs.closeSync(fs.openSync(filepath, 'a'))
      }
    }

    this.storageFd = await fs.promises.open(this.storageFilepath, 'r+')
    this.headerFd = await fs.promises.open(this.headerFilepath, 'r+')

    let headerReadBuffer = await this._readHeader()
    if (headerReadBuffer.every(byte => byte === 0)) {
      headerReadBuffer = await this._initializeHeader()
    }

    const length = headerReadBuffer.readUInt32BE(0)
    this._length = length

    const count = headerReadBuffer.readUInt32BE(4)
    this._count = count
  }

  /**
   * @name clear
   *
   * @docs
   * ```coffeescript [specscript]
   * clear() -> Promise<>
   * ```
   *
   * Clears all data from the disk hash table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * Empty promise.
   *
   * ```javascript
   * await ht.clear()
   * ```
   */
  async clear() {
    this.close()

    await fs.promises.rm(this.storageFilepath).catch(() => {})
    await fs.promises.rm(this.headerFilepath).catch(() => {})

    for (const filepath of [this.storageFilepath, this.headerFilepath]) {
      const dir = filepath.split('/').slice(0, -1).join('/')
      await fs.promises.mkdir(dir, { recursive: true })

      const now = new Date()
      try {
        fs.utimesSync(filepath, now, now)
      } catch (error) {
        fs.closeSync(fs.openSync(filepath, 'a'))
      }
    }

    this.storageFd = await fs.promises.open(this.storageFilepath, 'r+')
    this.headerFd = await fs.promises.open(this.headerFilepath, 'r+')

    const headerReadBuffer = await this._initializeHeader()

    const length = headerReadBuffer.readUInt32BE(0)
    this._length = length

    const count = headerReadBuffer.readUInt32BE(4)
    this._count = count
  }

  /**
   * @name destroy
   *
   * @docs
   * ```coffeescript [specscript]
   * destroy() -> Promise<>
   * ```
   *
   * Removes all system resources used by the disk hash table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * Empty promise.
   *
   * ```javascript
   * await ht.destroy()
   * ```
   */
  async destroy() {
    await fs.promises.rm(this.storageFilepath).catch(() => {})
    await fs.promises.rm(this.headerFilepath).catch(() => {})
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * close() -> undefined
   * ```
   *
   * Closes the underlying file handles used by the disk hash table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `undefined`
   *
   * ```javascript
   * ht.close()
   * ```
   */
  close() {
    this.storageFd.close()
    this.headerFd.close()
    this.storageFd = null
    this.headerFd = null
  }

  // _hash1(key string) -> number
  _hash1(key) {
    let hashCode = 0
    const prime = 31
    for (let i = 0; i < key.length; i++) {
      hashCode = (prime * hashCode + key.charCodeAt(i)) % this._length
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

  // header file
  // 32 bits / 4 bytes table length
  // 32 bits / 4 bytes item count

  // _readHeader() -> headerReadBuffer Promise<Buffer>
  async _readHeader() {
    const headerReadBuffer = Buffer.alloc(8)

    await this.headerFd.read({
      buffer: headerReadBuffer,
      offset: 0,
      position: 0,
      length: 8,
    })

    return headerReadBuffer
  }

  // _read(index number) -> readBuffer Promise<Buffer>
  async _read(index) {
    const position = index * DATA_SLICE_SIZE
    const readBuffer = Buffer.alloc(DATA_SLICE_SIZE)

    await this.storageFd.read({
      buffer: readBuffer,
      offset: 0,
      position,
      length: DATA_SLICE_SIZE,
    })

    return readBuffer
  }

  // _getKey(index number) -> key Promise<string>
  async _getKey(index) {
    if (index == -1) {
      throw new Error('Negative index')
    }

    const readBuffer = await this._read(index)
    const statusMarker = readBuffer.readUInt8(0)
    if (statusMarker === EMPTY) {
      return undefined
    }

    const keyByteLength = readBuffer.readUInt32BE(1)
    const keyBuffer = readBuffer.subarray(9, keyByteLength + 9)
    return keyBuffer.toString(ENCODING)
  }

  // _setStatusMarker(index number, marker number) -> Promise<>
  async _setStatusMarker(index, marker) {
    const position = index * DATA_SLICE_SIZE
    const buffer = Buffer.alloc(1)
    buffer.writeUInt8(marker, 0)

    await this.storageFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // _resize() -> Promise<>
  async _resize() {
  }

  /**
   * @name set
   *
   * @docs
   * ```coffeescript [specscript]
   * set(key string, value string) -> Promise<>
   * ```
   *
   * Sets and stores a value by key in the disk hash table.
   *
   * Arguments:
   *   * `key` - `string` - the key to set.
   *   * `value` - `string` - the value to set corresponding to the key.
   *
   * Return:
   *   * Empty promise.
   *
   * ```javascript
   * await ht.set('my-key', 'my-value')
   * ```
   */
  async set(key, value) {
    if (this.resizeRatio > 0 && (this._count / this._length) > this.resizeRatio) {
      this._resize()
    }

    let index = this._hash1(key)

    const startIndex = index
    const stepSize = this._hash2(key)

    let currentKey = await this._getKey(index)
    while (currentKey) {
      if (key == currentKey) {
        break
      }

      index = (index + stepSize) % this._length
      if (index == startIndex) {
        throw new Error('Disk hash table is full')
      }

      currentKey = await this._getKey(index)
    }

    if (currentKey == null) { // insert
      await this._incrementCount()
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

    await this.storageFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  /**
   * @name get
   *
   * @docs
   * ```coffeescript [specscript]
   * get(key string) -> value Promise<string>
   * ```
   *
   * Gets a value by key from the disk hash table.
   *
   * Arguments:
   *   * `key` - `string` - the key corresponding to the value.
   *
   * Return:
   *   * `value` - `string` - the value corresponding to the key.
   *
   * ```javascript
   * const value = await ht.get('my-key')
   * ```
   */
  async get(key) {
    let index = this._hash1(key)
    const startIndex = index
    const stepSize = this._hash2(key)

    let currentKey = await this._getKey(index)
    while (currentKey) {
      if (key == currentKey) {
        break
      }

      index = (index + stepSize) % this._length
      if (index == startIndex) {
        return undefined // entire table searched
      }

      currentKey = await this._getKey(index)
    }

    if (currentKey == null) {
      return undefined
    }

    const readBuffer = await this._read(index)
    const statusMarker = readBuffer.readUInt8(0)
    if (statusMarker === OCCUPIED) {
      const keyByteLength = readBuffer.readUInt32BE(1)
      const valueByteLength = readBuffer.readUInt32BE(5)
      const keyBuffer = readBuffer.subarray(9, keyByteLength + 9)
      const valueBuffer = readBuffer.subarray(
        9 + keyByteLength,
        9 + keyByteLength + valueByteLength
      )
      return valueBuffer.toString(ENCODING)
    }

    return undefined
  }

  /**
   * @name delete
   *
   * @docs
   * ```coffeescript [specscript]
   * delete(key string) -> didDelete Promise<boolean>
   * ```
   *
   * Deletes a key and corresponding value from the disk hash table.
   *
   * Arguments:
   *   * `key` - `string` - the key to delete.
   *
   * Return:
   *   * `didDelete` - `boolean` - a promise of whether the key and corresponding value was deleted.
   *
   * ```javascript
   * const didDelete = await ht.delete('my-key')
   * ```
   */
  async delete(key) {
    let index = this._hash1(key)
    const startIndex = index
    const stepSize = this._hash2(key)

    let currentKey = await this._getKey(index)
    while (currentKey) {
      if (key == currentKey) {
        break
      }

      index = (index + stepSize) % this._length
      if (index == startIndex) {
        return false // entire table searched
      }

      currentKey = await this._getKey(index)
    }

    if (currentKey == null) {
      return false
    }

    const readBuffer = await this._read(index)
    const statusMarker = readBuffer.readUInt8(0)

    if (statusMarker === OCCUPIED) {
      await this._setStatusMarker(index, REMOVED)
      await this._decrementCount()
      return true
    }

    return false
  }

  // _incrementCount() -> Promise<>
  async _incrementCount() {
    this._count += 1

    const position = 4
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(this._count, 0)

    await this.headerFd.write(buffer, {
      offset: 0,
      position,
      length: 4,
    })
  }

  // _decrementCount() -> Promise<>
  async _decrementCount() {
    this._count -= 1

    const position = 4
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(this._count, 0)

    await this.headerFd.write(buffer, {
      offset: 0,
      position,
      length: 4,
    })
  }

  /**
   * @name count
   *
   * @docs
   * ```coffeescript [specscript]
   * count() -> number
   * ```
   *
   * Returns the number of items (key-value pairs) in the disk hash table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `number` - the number of items in the disk hash table.
   */
  count() {
    return this._count
  }

}

module.exports = DiskHashTable
