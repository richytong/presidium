const DynamoDB = {}

DynamoDB.Table = require('./DynamoDBTable')
DynamoDB.Index = require('./DynamoDBIndex')
DynamoDB.Stream = require('./DynamoDBStream')

module.exports = DynamoDB
