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
 *   length: number,
 *   storageFilepath: string,
 *   headerFilepath: string,
 * }) -> DiskLinkedHashTable
 * ```
 */
class DiskLinkedHashTable {
  constructor(options) {
    this.length = options.length
    this.storageFilepath = options.storageFilepath
    this.headerFilepath = options.headerFilepath
    this.storageFd = null
    this.headerFd = null
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
  }

  // clear() -> Promise<>
  async clear() {
    await fs.promises.rm(this.storageFilepath).catch(() => {})
    await fs.promises.rm(this.headerFilepath).catch(() => {})
  }

  // close() -> ()
  close() {
    this.storageFd.close()
    this.headerFd.close()
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

  // header file
  // first 32 bits / 4 bytes item count
  // second 32 bits / 4 bytes first item index
  // third 32 bits / 4 bytes last item index

  // _readHeader() -> headerReadBuffer Promise<Buffer>
  async _readHeader() {
    const headerReadBuffer = Buffer.alloc(12)

    headerReadBuffer.writeInt32BE(0, 0)
    headerReadBuffer.writeInt32BE(-1, 4)
    headerReadBuffer.writeInt32BE(-1, 8)

    await this.headerFd.read({
      buffer: headerReadBuffer,
      offset: 0,
      position: 0,
      length: 12,
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
    const position = 4
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
    const position = 8
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

  // _parseItem(readBuffer Buffer, index number) -> { index: number, readBuffer: Buffer, sortValue: string|number, value: string }
  _parseItem(readBuffer, index) {
    const item = {}
    item.index = index
    item.readBuffer = readBuffer

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
    const index = headerReadBuffer.readInt32BE(4)
    if (index == -1) {
      return undefined
    }
    const readBuffer = await this._read(index)
    return this._parseItem(readBuffer, index)
  }

  // _getReverseStartItem() -> item { index: number, readBuffer: Buffer, sortValue: string|number, value: string }
  async _getReverseStartItem() {
    const headerReadBuffer = await this._readHeader()
    const index = headerReadBuffer.readInt32BE(8)
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

    const { bytesWritten } = await this.storageFd.write(buffer, {
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

    // find place to insert item in linked list
    // find previous and next nodes

    // let forwardIndex = -1 // forwardIndex for the item to insert
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

    const readBuffer = await this._read(index)

    const statusMarker = readBuffer.readUInt8(0)
    // TODO handle status marker

    const keyByteLength = readBuffer.readUInt32BE(1)
    const sortValueByteLength = readBuffer.readUInt32BE(5)
    const valueByteLength = readBuffer.readUInt32BE(9)
    const valueBuffer = readBuffer.subarray(
      21 + keyByteLength + sortValueByteLength,
      21 + keyByteLength + sortValueByteLength + valueByteLength
    )
    return valueBuffer.toString(ENCODING)
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
