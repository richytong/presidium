const assert = require('assert')
const CRC32 = require('./CRC32')

describe('CRC32', () => {
  it('Computes the Cyclic Redundancy Check (CRC) using a 32-bit checksum', async () => {
    const crc32 = new CRC32()
    assert.equal(crc32.update(Buffer.from('test', 'utf8')), crc32)
    assert.equal(crc32.update(Buffer.from('test2', 'utf8')), crc32)
    assert.equal(typeof crc32.checksum, 'number')
    assert.equal(typeof crc32.digest('base64'), 'string')

    assert.throws(
      () => crc32.digest('unknown'),
      new Error('invalid format unknown')
    )
  })
})
