require('rubico/global')
const fs = require('fs')
const nodePath = require('path')
const pathResolve = require('./internal/pathResolve')

/**
 * @name AwsCredentials
 *
 * @synopsis
 * ```coffeescript [specscript]
 * AwsCredentials(profile string, options? {
 *   credentialsFilename?: string,
 * }) -> awsCreds {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 * }
 * ```
 */

const AwsCredentials = async function (profile, options = {}) {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    const awsCreds = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
    if (process.env.AWS_REGION) {
      awsCreds.region = process.env.AWS_REGION
    }
    return awsCreds
  }

  const credentialsFilename = options.credentialsFilename ?? 'credentials'
  let credentialsFileDir = pathResolve(process.cwd())
  let lines = ''
  while (credentialsFileDir != '/') {
    const credentialsFilePath =
      pathResolve(credentialsFileDir, `.aws/${credentialsFilename}`)
    if (fs.existsSync(credentialsFilePath)) {
      lines = await (
        fs.promises.readFile(credentialsFilePath)
        .then(buffer => `${buffer}`.split('\n'))
      )
      break
    }
    credentialsFileDir = pathResolve(credentialsFileDir, '..')
  }

  const startingLineNumber = lines.findIndex(line => line == `[${profile}]`)

  const accessKeyId = lines.find(
    (line, index) => index > startingLineNumber
    && line.startsWith('aws_access_key_id')
  ).split(' = ')[1]
  const secretAccessKey = lines.find(
    (line, index) => index > startingLineNumber
    && line.startsWith('aws_secret_access_key')
  ).split(' = ')[1]

  return { accessKeyId, secretAccessKey }
}

module.exports = AwsCredentials
