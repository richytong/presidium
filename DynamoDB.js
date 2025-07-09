const DynamoDB = {}

DynamoDB.Table = require('./DynamoDBTable')
DynamoDB.GlobalSecondaryIndex = require('./DynamoDBGlobalSecondaryIndex')
DynamoDB.Stream = require('./DynamoDBStream')

module.exports = DynamoDB
