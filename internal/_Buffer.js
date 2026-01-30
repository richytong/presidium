/**
 * @name _Buffer
 *
 * @docs
 * Convert to Buffer
 *
 * ```coffeescript [specscript]
 * type TypedArray =
 *   Int8Array|Uint8Array|Uint8ClampedArray|Int16Array
 *   |Uint16Array|Int32Array|Uint32Array|Float16Array
 *   |Float32Array|Float64Array|BigInt64Array|BitUint64Array
 *
 * _Buffer(chunk string, encoding string) -> buffer Buffer
 * _Buffer(chunk Buffer) -> buffer Buffer
 * _Buffer(chunk TypedArray) -> buffer Buffer
 * ```
 */
function _Buffer(chunk, encoding = 'utf8') {
  if (typeof chunk == 'string') {
    return Buffer.from(chunk, encoding)
  }

  if (Buffer.isBuffer(chunk)) {
    return chunk
  }

  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }

  throw new TypeError(`Unable to convert ${chunk.constructor.name} to Buffer`)
}

module.exports = _Buffer
