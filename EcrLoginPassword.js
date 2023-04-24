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
 *   awsRegion: string,
 *   awsProfile: string,
 * }) -> Promise<password string>
 * ```
 */

const EcrLoginPassword = async function ({ awsRegion, awsProfile }) {
  const childprocess = exec(`
aws ecr --profile ${awsProfile} --region ${awsRegion} get-login-password
  `.trim())
  return streamToString(childprocess.stdout).then(callProp('trim'))
}

module.exports = EcrLoginPassword
