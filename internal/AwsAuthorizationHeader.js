require('rubico/global')
const crypto = require('crypto')
const AmzDate = require('./AmzDate')
const AmzSignedHeaders = require('./AmzSignedHeaders')
const AmzCanonicalHeaders = require('./AmzCanonicalHeaders')
const AmzSignature = require('./AmzSignature')

/**
 * @name AwsAuthorizationHeader
 *
 * @synopsis
 * ```coffeescript [specscript]
 * AwsAuthorizationHeader(options {
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
const AwsAuthorizationHeader = function (options) {
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

  if (!headers.Host) {
    headers.Host = endpoint // host is required
  }

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

  const queryParamPairs = []
  for (const key in queryParams) {
    const value = queryParams[key]
    queryParamPairs.push(key, value)
  }
  const canonicalQueryString = queryParamPairs.join('&')

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

module.exports = AwsAuthorizationHeader
