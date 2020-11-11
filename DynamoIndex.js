const Dynamo = require('./Dynamo')

/**
 * @name DynamoIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(dynamo string|DynamoDB|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }, tablename string, indexname string) -> DynamoTable
 * ```
 */
const DynamoIndex = function (dynamo, tablename, indexname) {
  if (typeof this == null || this.constructor != DynamoIndex) {
    return new DynamoIndex(dynamo, tablename)
  }
  this.dynamodb = new Dynamo(dynamo).dynamodb
  this.tablename = tablename
  this.indexname = indexname
}

/**
 * @name DynamoIndex.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(dynamo, tablename, indexname).query()
 * ```
 */
DynamoIndex.prototype.query = function query(options) {
  const params = {
    TableName: this.tablename,
    IndexName: this.indexname,
    ...options,
  }
}
