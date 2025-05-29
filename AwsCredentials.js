require('rubico/global')
const fs = require('fs')
const nodePath = require('path')
const pathResolve = require('./internal/pathResolve')

/**
 * @name AwsCredentials
 *
 * @synopsis
 * ```coffeescript [specscript]
 * AwsCredentials(options {
 *   profile?: string,
 *   credentialsFileDir?: string,
 * }) -> awsCreds {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 * }
 *
 * AwsCredentials(profile string) -> awsCreds {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 * }
 * ```
 */

const AwsCredentials = async function (options = {}) {
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

  const profile = (
    typeof options == 'string' ? options : options.profile
  ) ?? 'default'

  let credentialsFileDir =
    options.credentialsFileDir ?? pathResolve(process.cwd())
  let lines = ''
  while (credentialsFileDir != '/') {
    const credentialsFilePath =
      pathResolve(credentialsFileDir, '.aws/credentials')
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
