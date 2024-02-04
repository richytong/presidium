const get = require('rubico/get')
const callProp = require('rubico/x/callProp')
const { exec } = require('child_process')
const streamToString = require('./internal/streamToString')

/**
 * @name EcrLoginPassword
 *
 * @synopsis
 * ```coffeescript [specscript]
 * EcrLoginPassword(options {
 *   awsAccessKeyId?: string,
 *   awsSecretAccessKey?: string,
 *   awsProfile?: string,
 *   awsRegion: string,
 * }) -> Promise<password string>
 * ```
 */

const EcrLoginPassword = async function ({
  awsAccessKeyId,
  awsSecretAccessKey,
  awsRegion,
  awsProfile,
}) {
  if (awsAccessKeyId != null && awsSecretAccessKey != null) {
    const childprocess = exec(`
AWS_ACCESS_KEY_ID=${awsAccessKeyId} AWS_SECRET_ACCESS_KEY=${awsSecretAccessKey} aws ecr --region ${awsRegion} get-login-password
    `.trim())
    return streamToString(childprocess.stdout).then(callProp('trim'))
  }

  const childprocess = exec(`
aws ecr --profile ${awsProfile} --region ${awsRegion} get-login-password
  `.trim())
  return streamToString(childprocess.stdout).then(callProp('trim'))
}

module.exports = EcrLoginPassword
