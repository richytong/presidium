const crypto = require('crypto')

/*
 * @name AmzSignature
 *
 * @docs
 * ```coffeescript [specscript]
 * AmzSignature(options {
 *   secretAccessKey: string,
 *   datestamp: string,
 *   region: string,
 *   serviceName: string,
 *   stringToSign: string,
 * }) -> signature string
 * ```
 */
const AmzSignature = function (options) {
  const {
    secretAccessKey, datestamp, region, serviceName, stringToSign,
  } = options

  const h1 = hmac(`AWS4${secretAccessKey}`, datestamp)
  const h2 = hmac(h1, region)
  const h3 = hmac(h2, serviceName)
  const h4 = hmac(h3, 'aws4_request')
  return hmac(h4, stringToSign, 'hex')
}

const hmac = function (key, value, encoding) {
  return crypto
    .createHmac('sha256', key)
    .update(value, 'utf8')
    .digest(encoding)
}

module.exports = AmzSignature
