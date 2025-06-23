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
    || process.env.AWS_SECRET_ACCESS_KEY
    || process.env.AWS_REGION
  ) {
    if (process.env.AWS_ACCESS_KEY_ID == null) {
      throw new Error('unable to find AWS_ACCESS_KEY_ID in env')
    }
    if (process.env.AWS_SECRET_ACCESS_KEY == null) {
      throw new Error('unable to find AWS_SECRET_ACCESS_KEY in env')
    }
    if (process.env.AWS_REGION == null) {
      throw new Error('unable to find AWS_REGION in env')
    }
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    }
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

  const accessKeyId = startingLineNumber == -1 ? undefined : lines.find(
    (line, index) => index > startingLineNumber
      && line.startsWith('aws_access_key_id')
      && index - startingLineNumber < 3
  )?.split(' = ')[1]
  const secretAccessKey = startingLineNumber == -1 ? undefined : lines.find(
    (line, index) => index > startingLineNumber
      && line.startsWith('aws_secret_access_key')
      && index - startingLineNumber < 3
  )?.split(' = ')[1]

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

  const region = startingLineNumber2 == -1 ? undefined : lines2.find(
    (line, index) => index > startingLineNumber2
      && line.startsWith('region')
      && index - startingLineNumber < 2
  )?.split(' = ')[1]

  if (accessKeyId == null) {
    throw new Error(`unable to find aws_access_key_id for profile ${profile}`)
  }
  if (secretAccessKey == null) {
    throw new Error(`unable to find aws_secret_access_key for profile ${profile}`)
  }
  if (region == null) {
    throw new Error(`unable to find region for profile ${profile}`)
  }

  return { accessKeyId, secretAccessKey, region }
}

module.exports = AwsCredentials
