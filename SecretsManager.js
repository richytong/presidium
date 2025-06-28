require('rubico/global')
const AWSSecretsManager = require('aws-sdk/clients/secretsmanager')
require('aws-sdk/lib/maintenance_mode_message').suppress = true

/**
 * @name SecretsManager
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }|{
 *   endpoint: string,
 *   region: string,
 * }) -> secretsManager Object
 * ```
 */
const SecretsManager = function (options) {
  this.awsSecretsManager = new AWSSecretsManager({
    apiVersion: '2017-10-17',
    ...pick([
      'accessKeyId',
      'secretAccessKey',
      'region',
      'endpoint',
    ])(options),
  })
}

/**
 * @name SecretsManager.prototype.createSecret
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(...).createSecret(
 *   name string,
 *   secretString string,
 * ) -> result Promise<{
 *   ARN: string,
 *   Name: string,
 *   VersionId: string,
 * }>
 * ```
 */
SecretsManager.prototype.createSecret = function (name, secretString) {
  return this.awsSecretsManager.createSecret({
    Name: name,
    SecretString: secretString,
  }).promise().catch(async error => {
    if (error.name == 'ResourceExistsException') {
      const secretValue = await this.getSecretValue(name)
      return this.awsSecretsManager.updateSecret({
        SecretId: secretValue.ARN,
        SecretString: secretString,
      }).promise()
    }
    throw error
  })
}

/**
 * @name SecretsManager.prototype.updateSecret
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(...).updateSecret(
 *   name string,
 *   secretString string,
 * ) -> result Promise<{}>
 * ```
 */
SecretsManager.prototype.updateSecret = function (name, secretString) {
  return this.awsSecretsManager.updateSecret({
    Name: name,
    SecretString: secretString,
  }).promise()
}

/**
 * @name SecretsManager.prototype.putSecret
 *
 * @alias SecretsManager.prototype.createSecret
 */
SecretsManager.prototype.putSecret = function (...args) {
  return this.createSecret(...args)
}

/**
 * @name SecretsManager.prototype.getSecretValue
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(...).getSecretValue(name string) -> result Promise<{
 *   ARN: string,
 *   CreatedDate: Date,
 *   Name: string,
 *   SecretString: string,
 *   VersionId: string,
 *   VersionStages: Array<string>,
 * }>
 * ```
 */
SecretsManager.prototype.getSecretValue = function (name) {
  return this.awsSecretsManager.getSecretValue({
    SecretId: name,
  }).promise()
}

/**
 * @name SecretsManager.prototype.getSecretValue
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(...).getSecretValue(name string) -> result Promise<{
 *   ARN: string,
 *   CreatedDate: Date,
 *   Name: string,
 *   SecretString: string,
 *   VersionId: string,
 *   VersionStages: Array<string>,
 * }>
 * ```
 */
SecretsManager.prototype.getSecretString = function (name) {
  return this.awsSecretsManager.getSecretValue({
    SecretId: name,
  }).promise().then(get('SecretString'))
}

/**
 * @name SecretsManager.prototype.deleteSecret
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new SecretsManager(...).deleteSecret(name string) -> result Promise<{
 *   ARN: string,
 *   DeletionDate: Date,
 *   Name: string,
 * }>
 * ```
 */
SecretsManager.prototype.deleteSecret = function (name) {
  return this.awsSecretsManager.deleteSecret({
    SecretId: name,
    ForceDeleteWithoutRecovery: true,
  }).promise()
}

module.exports = SecretsManager
