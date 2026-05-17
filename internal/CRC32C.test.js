const assert = require('assert')
const CRC32C = require('./CRC32C')

describe('CRC32C', () => {
  it('Computes the Cyclic Redundancy Check (CRC) using a 32-bit checksum', async () => {
    const crc32c = new CRC32C()
    assert.equal(crc32c.update(Buffer.from('test', 'utf8')), crc32c)
    assert.equal(crc32c.update(Buffer.from('test2', 'utf8')), crc32c)
    assert.equal(typeof crc32c.checksum, 'number')
    assert.equal(typeof crc32c.digest('base64'), 'string')

    assert.throws(
      () => crc32c.digest('unknown'),
      new Error('invalid format unknown')
    )
  })
})
