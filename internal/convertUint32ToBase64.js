/**
 * @name convertUint32ToBase64
 *
 * @docs
 * ```coffeescript [specscript]
 * convertUint32ToBase64(number) -> base64Encoded string
 * ```
 */
function convertUint32ToBase64(number) {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)

  view.setUint32(0, number, false)

  const uint8Array = new Uint8Array(buffer)
  const binaryString = String.fromCharCode(...uint8Array)
  const base64String = btoa(binaryString)

  return base64String
}

module.exports = convertUint32ToBase64
