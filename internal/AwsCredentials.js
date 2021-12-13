const fsp = require('fs/promises')
const eq = require('rubico/eq')
const identity = require('rubico/x/identity')

/**
 * @name AwsCredentials
 *
 * @synopsis
 * ```coffeescript [specscript]
 * AwsCredentials(profile string) -> Promise<{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }>
 * ```
 */
const AwsCredentials = function (profile) {
  return fsp.readFile(`${process.env.HOME}/.aws/credentials`)
  .then(buffer => {
    const lines = `${buffer}`.split('\n'),
      startingLineNumber = lines.findIndex(eq(`[${profile}]`, identity))
    return {
      accessKeyId: lines.find((line, index) => index > startingLineNumber
      && line.startsWith('aws_access_key_id')).split(' = ')[1],
      secretAccessKey: lines.find((line, index) => index > startingLineNumber
      && line.startsWith('aws_secret_access_key')).split(' = ')[1],
      region: 'us-west-1',
    }
  })
}

module.exports = AwsCredentials
