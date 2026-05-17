const crc32c = require('fast-crc32c')
const convertUint32ToBase64 = require('./convertUint32ToBase64')

class CRC32C {
  constructor() {
    this.checksum = undefined
  }

  // update(chunk Buffer) -> undefined
  update(chunk) {
    if (this.checksum == null) {
      this.checksum = crc32c.calculate(chunk)
    } else {
      this.checksum = crc32c.calculate(chunk, this.checksum)
    }
    return this
  }

  // digest(format string) -> string
  digest(format) {
    if (format == 'base64') {
      return convertUint32ToBase64(this.checksum)
    }
    throw new Error(`invalid format ${format}`)
  }
}

module.exports = CRC32C
