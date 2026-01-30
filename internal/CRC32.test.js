const assert = require('assert')
const CRC32 = require('./CRC32')

describe('CRC32', () => {
  it('Computes the Cyclic Redundancy Check (CRC) using a 32-bit checksum', async () => {
    const crc32 = new CRC32()
    crc32.update(Buffer.from('test', 'utf8'))
    assert.equal(crc32.checksum, 3632233996)
  })
})
