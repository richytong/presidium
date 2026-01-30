require('rubico/global')
const crypto = require('crypto')
const AmzDate = require('./AmzDate')
const AmzSignedHeaders = require('./AmzSignedHeaders')
const AmzCanonicalHeaders = require('./AmzCanonicalHeaders')
const AmzSignature = require('./AmzSignature')

/**
 * @name AwsAuthorization
 *
 * @docs
 * ```coffeescript [specscript]
 * AwsAuthorization(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   method: string, # GET
 *   endpoint: string, # transcribestreaming.${region}.amazonaws.com:8443
 *   protocol: string, # wss
 *   canonicalUri: string, # /stream-transcription-websocket
 *   serviceName: string, # transcribe
 *   payloadHash: string,
 *   expires: number, # 300
 *   queryParams: URLSearchParams,
 *   headers: Object,
 * }) -> headerField string
 * ```
 */
const AwsAuthorization = function (options) {
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
    queryParams = new URLSearchParams(),
    headers = {},
  } = options

  const amzDate = headers['X-Amz-Date'] ?? AmzDate()
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

  queryParams.sort()
  const canonicalQueryString = queryParams.toString()

  const signedHeaders = AmzSignedHeaders(headers)

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    AmzCanonicalHeaders(headers),
    signedHeaders,
    payloadHash,
  ].join('\n')

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')
  ].join('\n')

  const signature = AmzSignature({
    secretAccessKey, datestamp, region, serviceName, stringToSign,
  })

  return `${algorithm} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

module.exports = AwsAuthorization
