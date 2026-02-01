require('rubico/global')
const fs = require('fs')
const resolvePath = require('./internal/resolvePath')

/**
 * @name AwsCredentials
 *
 * @docs
 * ```coffeescript [specscript]
 * AwsCredentials(profile string, options {
 *   credentialsFileDirname: string
 *   credentialsFilename: string,
 *   recurse: boolean,
 * }) -> awsCreds Promise<{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 * }>
 * ```
 *
 * Finds and reads the AWS access key ID and secret access key from local files. Looks in the `~/.aws/credentials` file by default.
 *
 * Arguments:
 *   * `profile` - the AWS profile associated with the credentials. Defaults to 'default'.
 *   * `options`
 *     * `credentialsFileDirname` - the name of the directory that stores the credentials file. Defaults to '.aws'.
 *     * `credentialsFilename` - the name of the credentials file. Defaults to 'credentials'.
 */

const AwsCredentials = async function (profile, options = {}) {
  if (profile == null) {
    profile = 'default'
  }

  const recurse = options.recurse ?? true
  const credentialsFileDirname = options.credentialsFileDirname ?? '.aws'
  const credentialsFilename = options.credentialsFilename ?? 'credentials'
  let credentialsFileDir = resolvePath(process.cwd())
  let lines = ''
  while (recurse && credentialsFileDir != '/') {
    const credentialsFilePath =
      resolvePath(credentialsFileDir, `${credentialsFileDirname}/${credentialsFilename}`)
    if (fs.existsSync(credentialsFilePath)) {
      lines = await fs.promises.readFile(credentialsFilePath)
        .then(buffer => buffer.toString('utf8').split('\n'))
      break
    }
    credentialsFileDir = resolvePath(credentialsFileDir, '..')
  }

  if (lines == '') {
    throw new Error('Missing .aws/credentials file')
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

  if (accessKeyId == null) {
    throw new Error(`unable to find aws_access_key_id for profile ${profile}`)
  }
  if (secretAccessKey == null) {
    throw new Error(`unable to find aws_secret_access_key for profile ${profile}`)
  }

  return { accessKeyId, secretAccessKey }
}

module.exports = AwsCredentials
