const fs = require('fs')

const DATA_SLICE_SIZE = 512 * 1024

const ENCODING = 'utf8'

const EMPTY = 0

const OCCUPIED = 1

const REMOVED = 2

/**
 * @name DiskLinkedHashTable
 *
 * @docs
 * ```coffeescript [specscript]
 * new DiskLinkedHashTable(options {
 *   initialLength: number,
 *   storageFilepath: string,
 *   headerFilepath: string,
 * }) -> DiskLinkedHashTable
 * ```
 */
class DiskLinkedHashTable {
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
    const headerReadBuffer = Buffer.alloc(16)
    headerReadBuffer.writeUInt32BE(this.initialLength, 0)
    headerReadBuffer.writeUInt32BE(0, 4)
    headerReadBuffer.writeInt32BE(-1, 8)
    headerReadBuffer.writeInt32BE(-1, 12)

    await this.headerFd.write(headerReadBuffer, {
      offset: 0,
      position: 0,
      length: headerReadBuffer.length,
    })

    return headerReadBuffer
  }

  // init() -> Promise<>
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

  // clear() -> Promise<>
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

  // destroy() -> Promise<>
  async destroy() {
    await fs.promises.rm(this.storageFilepath).catch(() => {})
    await fs.promises.rm(this.headerFilepath).catch(() => {})
  }

  // close() -> ()
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
  // 32 bits / 4 bytes first item index
  // 32 bits / 4 bytes last item index

  // _readHeader() -> headerReadBuffer Promise<Buffer>
  async _readHeader() {
    const headerReadBuffer = Buffer.alloc(16)

    await this.headerFd.read({
      buffer: headerReadBuffer,
      offset: 0,
      position: 0,
      length: 16,
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

  // _writeFirstIndex(index number) -> Promise<>
  async _writeFirstIndex(index) {
    const position = 8
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(index, 0)

    await this.headerFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // _writeLastIndex(index number) -> Promise<>
  async _writeLastIndex(index) {
    const position = 12
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(index, 0)

    await this.headerFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
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
    const keyBuffer = readBuffer.subarray(21, keyByteLength + 21)
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

  // _parseItem(readBuffer Buffer, index number) -> { index: number, readBuffer: Buffer, sortValue: string|number, value: string }
  _parseItem(readBuffer, index) {
    const item = {}
    item.index = index
    item.readBuffer = readBuffer

    const statusMarker = readBuffer.readUInt8(0)
    item.statusMarker = statusMarker

    const forwardIndex = readBuffer.readInt32BE(13)
    const reverseIndex = readBuffer.readInt32BE(17)
    item.forwardIndex = forwardIndex
    item.reverseIndex = reverseIndex

    const keyByteLength = readBuffer.readUInt32BE(1)
    const sortValueByteLength = readBuffer.readInt32BE(5)
    const sortValueBuffer = readBuffer.subarray(
      21 + keyByteLength,
      21 + keyByteLength + sortValueByteLength
    )
    const sortValue = sortValueBuffer.toString(ENCODING)
    item.sortValue = sortValue

    const valueByteLength = readBuffer.readUInt32BE(9)
    const valueBuffer = readBuffer.subarray(
      21 + keyByteLength + sortValueByteLength,
      21 + keyByteLength + sortValueByteLength + valueByteLength
    )
    const value = valueBuffer.toString(ENCODING)
    item.value = value

    return item
  }

  // _getForwardStartItem() -> item { index: number, readBuffer: Buffer, sortValue: string|number, value: string }
  async _getForwardStartItem() {
    const headerReadBuffer = await this._readHeader()
    const index = headerReadBuffer.readInt32BE(8)
    if (index == -1) {
      return undefined
    }
    const readBuffer = await this._read(index)
    return this._parseItem(readBuffer, index)
  }

  // _getReverseStartItem() -> item { index: number, readBuffer: Buffer, sortValue: string|number, value: string }
  async _getReverseStartItem() {
    const headerReadBuffer = await this._readHeader()
    const index = headerReadBuffer.readInt32BE(12)
    if (index == -1) {
      return undefined
    }
    const readBuffer = await this._read(index)
    return this._parseItem(readBuffer, index)
  }

  // _getItem(index number) -> item { index: number, readBuffer: Buffer, sortValue: string|number, value: string }
  async _getItem(index) {
    if (index == -1) {
      return undefined
    }
    const readBuffer = await this._read(index)
    return this._parseItem(readBuffer, index)
  }

  // _updateForwardIndex(index number, forwardIndex number) -> Promise<>
  async _updateForwardIndex(index, forwardIndex) {
    const position = (index * DATA_SLICE_SIZE) + 13
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(forwardIndex, 0)

    await this.storageFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // _updateReverseIndex(index number, reverseIndex number) -> Promise<>
  async _updateReverseIndex(index, reverseIndex) {
    const position = (index * DATA_SLICE_SIZE) + 17
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(reverseIndex, 0)

    await this.storageFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // _insert(key string, value string, sortValue number|string, index number) -> Promise<>
  async _insert(key, value, sortValue, index) {
    const forwardStartItem = await this._getForwardStartItem()
    let previousForwardItem = null
    let currentForwardItem = forwardStartItem
    while (currentForwardItem) {
      const left = typeof sortValue == 'string' ? currentForwardItem.sortValue : Number(currentForwardItem.sortValue)
      if (sortValue > left) {
        previousForwardItem = currentForwardItem
        currentForwardItem = await this._getItem(previousForwardItem.forwardIndex)
        continue
      }
      break
    }

    let reverseIndex = -1
    let forwardIndex = -1
    if (previousForwardItem == null) { // item to insert is first in the list
      await this._writeFirstIndex(index)
      if (forwardStartItem == null) { // item to insert is also last in the list
        await this._writeLastIndex(index)
      } else {
        forwardIndex = forwardStartItem.index
        await this._updateReverseIndex(forwardStartItem.index, index)
      }
    } else if (previousForwardItem.forwardIndex == -1) { // item to insert is the last in the list
      await this._writeLastIndex(index)
      await this._updateForwardIndex(previousForwardItem.index, index)
      reverseIndex = previousForwardItem.index
    } else { // item to insert is ahead of previousForwardItem and there was an item ahead of previousForwardItem
      await this._updateForwardIndex(previousForwardItem.index, index)
      await this._updateReverseIndex(currentForwardItem.index, index)
      forwardIndex = previousForwardItem.forwardIndex
      reverseIndex = previousForwardItem.index
    }

    const position = index * DATA_SLICE_SIZE
    const buffer = Buffer.alloc(DATA_SLICE_SIZE)
    const sortValueString = typeof sortValue == 'string' ? sortValue : sortValue.toString()

    // 8 bits / 1 byte for status marker: 0 empty / 1 occupied / 2 deleted
    // 32 bits / 4 bytes for key size
    // 32 bits / 4 bytes for sort value size
    // 32 bits / 4 bytes for value size
    // 32 bits / 4 bytes for forward index
    // 32 bits / 4 bytes for reverse index
    // chunk for key
    // chunk for sort value
    // remainder for value
    const statusMarker = 1
    const keyByteLength = Buffer.byteLength(key, ENCODING)
    const sortValueByteLength = Buffer.byteLength(sortValueString, ENCODING)
    const valueByteLength = Buffer.byteLength(value, ENCODING)
    buffer.writeUInt8(statusMarker, 0)
    buffer.writeUint32BE(keyByteLength, 1)
    buffer.writeUint32BE(sortValueByteLength, 5)
    buffer.writeUint32BE(valueByteLength, 9)
    buffer.writeInt32BE(forwardIndex, 13)
    buffer.writeInt32BE(reverseIndex, 17)
    buffer.write(key, 21, keyByteLength, ENCODING)
    buffer.write(sortValueString, 21 + keyByteLength, sortValueByteLength, ENCODING)
    buffer.write(value, 21 + keyByteLength + sortValueByteLength, valueByteLength, ENCODING)

    await this.storageFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
  }

  // _update(key string, value string, sortValue number|string, index number) -> Promise<>
  async _update(key, value, sortValue, index) {
    const item = await this._getItem(index)

    let forwardIndex = item.forwardIndex
    let reverseIndex = item.reverseIndex

    if (sortValue != item.sortValue) {
      if (item.reverseIndex == -1) { // item to update is first in the list
        if (item.forwardIndex > -1) { // there is an item behind item to update
          await this._updateReverseIndex(item.forwardIndex, -1)
          await this._writeFirstIndex(item.forwardIndex)
        } else { // item to update is first and last in the list
          await this._writeFirstIndex(-1)
          await this._writeLastIndex(-1)
        }
      } else if (item.forwardIndex == -1) { // item to update is last in the list
        if (item.reverseIndex > -1) { // there is an item ahead of item to update
          await this._updateForwardIndex(item.reverseIndex, -1)
          await this._writeLastIndex(item.forwardIndex)
        } else { // item to update is first and last in the list
        }
      } else { // item to update is in the middle of the list
        await this._updateReverseIndex(item.forwardIndex, item.reverseIndex)
        await this._updateForwardIndex(item.reverseIndex, item.forwardIndex)
      }

      const forwardStartItem = await this._getForwardStartItem()
      let previousForwardItem = null
      let currentForwardItem = forwardStartItem
      while (currentForwardItem) {
        const left = typeof sortValue == 'string' ? currentForwardItem.sortValue : Number(currentForwardItem.sortValue)
        if (sortValue > left) {
          previousForwardItem = currentForwardItem
          currentForwardItem = await this._getItem(previousForwardItem.forwardIndex)
          continue
        }
        break
      }

      if (previousForwardItem == null) { // item to update is first in the list
        reverseIndex = -1
        await this._writeFirstIndex(index)
        if (forwardStartItem == null) { // item to update is also last in the list
          forwardIndex = -1
          await this._writeLastIndex(index)
        } else {
          forwardIndex = forwardStartItem.index
          await this._updateReverseIndex(forwardStartItem.index, index)
        }
      } else if (previousForwardItem.forwardIndex == -1) { // item to insert is the last in the list
        forwardIndex = -1
        await this._writeLastIndex(index)
        await this._updateForwardIndex(previousForwardItem.index, index)
        reverseIndex = previousForwardItem.index
      } else { // item to insert is ahead of previousForwardItem and there was an item ahead of previousForwardItem
        await this._updateForwardIndex(previousForwardItem.index, index)
        await this._updateReverseIndex(currentForwardItem.index, index)
        forwardIndex = previousForwardItem.forwardIndex
        reverseIndex = previousForwardItem.index
      }

    }

    const position = index * DATA_SLICE_SIZE
    const buffer = Buffer.alloc(DATA_SLICE_SIZE)
    const sortValueString = typeof sortValue == 'string' ? sortValue : sortValue.toString()

    // 8 bits / 1 byte for status marker: 0 empty / 1 occupied / 2 deleted
    // 32 bits / 4 bytes for key size
    // 32 bits / 4 bytes for sort value size
    // 32 bits / 4 bytes for value size
    // 32 bits / 4 bytes for forward index
    // 32 bits / 4 bytes for reverse index
    // chunk for key
    // chunk for sort value
    // remainder for value
    const statusMarker = 1
    const keyByteLength = Buffer.byteLength(key, ENCODING)
    const sortValueByteLength = Buffer.byteLength(sortValueString, ENCODING)
    const valueByteLength = Buffer.byteLength(value, ENCODING)
    buffer.writeUInt8(statusMarker, 0)
    buffer.writeUint32BE(keyByteLength, 1)
    buffer.writeUint32BE(sortValueByteLength, 5)
    buffer.writeUint32BE(valueByteLength, 9)
    buffer.writeInt32BE(forwardIndex, 13)
    buffer.writeInt32BE(reverseIndex, 17)
    buffer.write(key, 21, keyByteLength, ENCODING)
    buffer.write(sortValueString, 21 + keyByteLength, sortValueByteLength, ENCODING)
    buffer.write(value, 21 + keyByteLength + sortValueByteLength, valueByteLength, ENCODING)

    await this.storageFd.write(buffer, {
      offset: 0,
      position,
      length: buffer.length,
    })
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
      index = (index + stepSize) % this._length
      if (index == startIndex) {
        throw new Error('Hash table is full')
      }
      currentKey = await this._getKey(index)
    }

    if (currentKey == null) {
      await this._insert(key, value, sortValue, index)
      await this._incrementCount()
    } else {
      await this._update(key, value, sortValue, index)
    }
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
      const sortValueByteLength = readBuffer.readUInt32BE(5)
      const valueByteLength = readBuffer.readUInt32BE(9)
      const valueBuffer = readBuffer.subarray(
        21 + keyByteLength + sortValueByteLength,
        21 + keyByteLength + sortValueByteLength + valueByteLength
      )
      return valueBuffer.toString(ENCODING)
    }

    return undefined
  }

  // forwardIterator() -> values AsyncGenerator<string>
  async * forwardIterator() {
    let currentForwardItem = await this._getForwardStartItem()
    while (currentForwardItem) {
      yield currentForwardItem.value
      currentForwardItem = await this._getItem(currentForwardItem.forwardIndex)
    }
  }

  // reverseIterator() -> values AsyncGenerator<string>
  async * reverseIterator() {
    let currentReverseItem = await this._getReverseStartItem()
    while (currentReverseItem) {
      yield currentReverseItem.value
      currentReverseItem = await this._getItem(currentReverseItem.reverseIndex)
    }
  }

  /**
   * @name delete
   *
   * @docs
   * ```coffeescript [specscript]
   * delete(key string) -> didDelete Promise<boolean>
   * ```
   *
   * Deletes a key and corresponding value from the disk linked hash table.
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

    const item = await this._getItem(index)

    if (item.reverseIndex == -1) { // item to delete is first in the list
      if (item.forwardIndex > -1) { // there is an item behind item to delete
        await this._updateReverseIndex(item.forwardIndex, -1)
        await this._writeFirstIndex(item.forwardIndex)
      } else { // item to remove is first and last in the list
        await this._writeFirstIndex(-1)
        await this._writeLastIndex(-1)
      }
    } else if (item.forwardIndex == -1) { // item to delete is last in the list
      if (item.reverseIndex > -1) { // there is an item ahead of item to delete
        await this._updateForwardIndex(item.reverseIndex, -1)
        await this._writeLastIndex(item.forwardIndex)
      } else { // item is first and last in the list (handled above)
      }
    } else { // item to delete is in the middle of the list
      await this._updateReverseIndex(item.forwardIndex, item.reverseIndex)
      await this._updateForwardIndex(item.reverseIndex, item.forwardIndex)
    }

    if (item.statusMarker === OCCUPIED) {
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
   * Returns the number of items (key-value pairs) in the disk linked hash table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `number` - the number of items in the disk hash table.
   *
   * ```javascript
   * const count = ht.count()
   * ```
   */
  count() {
    return this._count
  }

}

module.exports = DiskLinkedHashTable
