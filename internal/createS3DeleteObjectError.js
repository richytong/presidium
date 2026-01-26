/**
 * @name createS3DeleteObjectError
 *
 * @docs
 * ```coffeescript [specscript]
 * createS3DeleteObjectError(ErrorData {
 *   Key: string,
 *   VersionId: string,
 *   Code: string,
 *   Message: string,
 * }) -> error AwsError {
 *   Key: string,
 *   VersionId: string,
 * }
 * ```
 */
function createS3DeleteObjectError(ErrorData) {
  const error = new Error(ErrorData.Message)
  error.name = ErrorData.Code ?? 'AwsError'
  error.Key = ErrorData.Key
  if (ErrorData.VersionId) {
    error.VersionId = ErrorData.VersionId
  }
  return error
}

module.exports = createS3DeleteObjectError
