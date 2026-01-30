require('rubico/global')
const crypto = require('crypto')
const AmzDate = require('./AmzDate')
const AmzSignedHeaders = require('./AmzSignedHeaders')
const AmzCanonicalHeaders = require('./AmzCanonicalHeaders')
const AmzSignature = require('./AmzSignature')

/**
 * @name AwsPresignedUrlV4
 *
 * @docs
 * ```coffeescript [specscript]
 * AwsPresignedUrlV4(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   method: string, // GET
 *   endpoint: string, // transcribestreaming.${region}.amazonaws.com:8443
 *   protocol: string, // wss
 *   canonicalUri: string, // /stream-transcription-websocket
 *   serviceName: string, // transcribe
 *   payloadHash: string,
 *   expires?: number, // 300
 *   queryParams?: Object,
 *   headers?: Object,
 * }) -> url string
 * ```
 */
const AwsPresignedUrlV4 = function (options) {
  const {
    accessKeyId,
    secretAccessKey,
    region,
    method,
    endpoint,
    protocol,
    canonicalUri,
    serviceName,
    payloadHash,
    expires = 300,
    queryParams = {},
    headers = {},
  } = options

  headers.Host = endpoint // host is required

  const amzDate = AmzDate()
  const datestamp = amzDate.split('T')[0]
  const algorithm = 'AWS4-HMAC-SHA256'

  const credentialScope = [
    datestamp,
    region,
    serviceName,
    'aws4_request',
  ].join('/')

  const credential = [
    accessKeyId,
    credentialScope,
  ].join('/')

  let canonicalQueryString = ''

  // aws request parameters
  canonicalQueryString += `X-Amz-Algorithm=${encodeURIComponent(algorithm)}`
  canonicalQueryString += `&X-Amz-Credential=${encodeURIComponent(credential)}`
  canonicalQueryString += `&X-Amz-Date=${encodeURIComponent(amzDate)}`
  canonicalQueryString += `&X-Amz-Expires=${encodeURIComponent(expires)}`
  canonicalQueryString += `&X-Amz-SignedHeaders=${encodeURIComponent(AmzSignedHeaders(headers))}`

  for (const key in queryParams) {
    const value = queryParams[key]
    canonicalQueryString += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  }

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    AmzCanonicalHeaders(headers),
    AmzSignedHeaders(headers),
    payloadHash,
  ].join('\n')

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')
  ].join('\n')

  canonicalQueryString += `&X-Amz-Signature=${AmzSignature({
    secretAccessKey, datestamp, region, serviceName, stringToSign,
  })}`

  return `${protocol}://${endpoint}${canonicalUri}?${canonicalQueryString}`
}

module.exports = AwsPresignedUrlV4
