const assert = require('assert')
const _Buffer = require('./_Buffer')

describe('_Buffer', () => {
  it('Converts string to Buffer', async () => {
    assert.deepEqual(_Buffer('test'), Buffer.from([0x74, 0x65, 0x73, 0x74]))
    assert.deepEqual(_Buffer('test', 'utf8'), Buffer.from([0x74, 0x65, 0x73, 0x74]))
    assert.deepEqual(_Buffer('test', 'base64'), Buffer.from([0xb5, 0xeb, 0x2d]))
  })

  it('Converts Buffer to Buffer', async () => {
    assert.deepEqual(_Buffer(Buffer.from([0x00, 0x01, 0x02])), Buffer.from([0x00, 0x01, 0x02]))
    assert.deepEqual(_Buffer(Buffer.from([])), Buffer.from([]))
  })

  it('Converts TypedArray to Buffer', async () => {
    assert.deepEqual(_Buffer(
      new Uint8Array([0x74, 0x65, 0x73, 0x74])),
      Buffer.from([0x74, 0x65, 0x73, 0x74])
    )

    assert.deepEqual(_Buffer(
      new Uint32Array([0x74, 0x65, 0x73, 0x74])),
      Buffer.from([ // LE
        0x74, 0, 0, 0,
        0x65, 0, 0, 0,
        0x73, 0, 0, 0,
        0x74, 0, 0, 0
      ])
    )

    assert.deepEqual(
      _Buffer(new Uint32Array([0x12345678])),
      Buffer.from([0x78, 0x56, 0x34, 0x12]) // LE
    )
  })

  it('Throws TypeError for non string, Buffer, or TypedArray', async () => {
    assert.throws(
      () => _Buffer([]),
      new TypeError('Unable to convert Array to Buffer')
    )

    assert.throws(
      () => _Buffer(1),
      new TypeError('Unable to convert Number to Buffer')
    )
  })
})
