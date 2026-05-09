// createS3DeleteAllObjectsAggregateError(Errors Array<{ Key: string, VersionId: string, Code: string, Message: string }>) -> AggregateError
function createS3DeleteAllObjectsAggregateError(Errors) {
  const errors = Errors.map(({ Key, VersionId, Code, Message }) => {
    if (VersionId) {
      const error = new Error(`${Key}/${VersionId}: ${Message}`)
      error.name = Code
      return error
    }
    const error = new Error(`${Key}: ${Message}`)
    error.name = Code
    return error
  })
  return new AggregateError(errors)
}

module.exports = createS3DeleteAllObjectsAggregateError
