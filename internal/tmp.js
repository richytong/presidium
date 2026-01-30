// Generate CRC32C lookup table (Castagnoli polynomial)
const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256)
  const poly = 0x1EDC6F41
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ poly : (crc >>> 1)
    }
    table[i] = crc >>> 0
  }
  return table
})()

/**
 * Calculate CRC32C checksum of a string or Uint8Array
 * @param {string | Uint8Array | Buffer} input
 * @returns {number} 32-bit unsigned integer checksum
 */
function crc32c(input) {
  if (typeof input === 'string') {
    input = new TextEncoder().encode(input) // Convert string to Uint8Array
  }

  let crc = 0xFFFFFFFF
  for (let i = 0; i < input.length; i++) {
    const byte = input[i]
    const index = (crc ^ byte) & 0xFF
    crc = (crc >>> 8) ^ CRC32C_TABLE[index]
  }

  return (crc ^ 0xFFFFFFFF) >>> 0
}

module.exports = crc32c

// Example usage:
// console.log(crc32c('test').toString(16)) // → "e3069283"
