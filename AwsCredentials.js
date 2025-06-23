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
 *   credentialsFileDirname?: string
 *   credentialsFilename?: string,
 *   configFileDirname?: string
 *   configFilename?: string,
 * }) -> awsCreds {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 * }
 * ```
 */

const AwsCredentials = async function (profile, options = {}) {
  if (
    process.env.AWS_ACCESS_KEY_ID
    && process.env.AWS_SECRET_ACCESS_KEY
    && process.env.AWS_REGION
  ) {
    const awsCreds = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    }
    return awsCreds
  }

  if (
    process.env.AWS_ACCESS_KEY_ID
    && process.env.AWS_SECRET_ACCESS_KEY
  ) {
    const awsCreds = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
    return awsCreds
  }

  if (profile == null) {
    profile = 'default'
  }

  const credentialsFileDirname = options.credentialsFileDirname ?? '.aws'
  const credentialsFilename = options.credentialsFilename ?? 'credentials'
  let credentialsFileDir = pathResolve(process.cwd())
  let lines = ''
  while (credentialsFileDir != '/') {
    const credentialsFilePath =
      pathResolve(credentialsFileDir, `${credentialsFileDirname}/${credentialsFilename}`)
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

  const configFileDirname = options.configFileDirname ?? '.aws'
  const configFilename = options.configFilename ?? 'config'
  let configFileDir = pathResolve(process.cwd())
  let lines2 = ''
  while (configFileDir != '/') {
    const configFilePath = pathResolve(configFileDir, `${configFileDirname}/${configFilename}`)
    if (fs.existsSync(configFilePath)) {
      lines2 = await (
        fs.promises.readFile(configFilePath)
        .then(buffer => `${buffer}`.split('\n'))
      )
      break
    }
    configFileDir = pathResolve(configFileDir, '..')
  }

  const startingLineNumber2 = lines2.findIndex(line => line == `[${profile}]`)

  const region = lines2.find(
    (line, index) => index > startingLineNumber2
      && line.startsWith('region')
  ).split(' = ')[1]

  return { accessKeyId, secretAccessKey, region }
}

module.exports = AwsCredentials
