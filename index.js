const HTTP = require('./HTTP')
const WebSocketServer = require('./WebSocketServer')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')
const DynamoIndex = require('./DynamoIndex')
const DynamoStream = require('./DynamoStream')
const Docker = require('./Docker')
const DockerImage = require('./DockerImage')
const DockerContainer = require('./DockerContainer')
const DockerSwarm = require('./DockerSwarm')
const DockerService = require('./DockerService')
const Kinesis = require('./Kinesis')
const KinesisStream = require('./KinesisStream')
const Mongo = require('./Mongo')
const MongoCollection = require('./MongoCollection')
const ElasticsearchIndex = require('./ElasticsearchIndex')
const S3 = require('./S3')
const S3Bucket = require('./S3Bucket')
const TranscribeStream = require('./TranscribeStream')
const EC2 = require('./EC2')
const AutoScaling = require('./AutoScaling')
const ECR = require('./ECR')

const Presidium = {
  HTTP,
  WebSocketServer,
  Dynamo,
  DynamoTable,
  DynamoIndex,
  DynamoStream,
  Docker,
  DockerImage,
  DockerContainer,
  DockerSwarm,
  DockerService,
  Kinesis,
  KinesisStream,
  Mongo,
  MongoCollection,
  ElasticsearchIndex,
  S3,
  S3Bucket,
  TranscribeStream,
  EC2,
  AutoScaling,
}

module.exports = Presidium
