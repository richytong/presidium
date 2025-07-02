globalThis.Archive = require('./Archive')
globalThis.AutoScaling = require('./AutoScaling')
globalThis.AwsCredentials = require('./AwsCredentials')
globalThis.Dependency = require('./Dependency')
globalThis.Docker = require('./Docker')
globalThis.DockerContainer = require('./DockerContainer')
globalThis.DockerImage = require('./DockerImage')
globalThis.DockerService = require('./DockerService')
globalThis.DockerSwarm = require('./DockerSwarm')
globalThis.DynamoTable = require('./DynamoTable')

globalThis.DynamoDB = {}
globalThis.DynamoDB.Table = require('./DynamoTable')
globalThis.DynamoDB.GlobalSecondaryIndex = require('./DynamoIndex')
globalThis.DynamoDB.GSI = require('./DynamoIndex')
globalThis.DynamoDB.Stream = require('./DynamoStream')

globalThis.DynamoTable = require('./DynamoTable')
globalThis.DynamoIndex = require('./DynamoIndex')
globalThis.DynamoStream = require('./DynamoStream')

globalThis.EC2 = require('./EC2')
globalThis.ECR = require('./ECR')
globalThis.Http = require('./Http')
globalThis.WebSocket = require('./WebSocket')
globalThis.NpmToken = require('./NpmToken')
globalThis.S3Bucket = require('./S3Bucket')
// TODO after rename
