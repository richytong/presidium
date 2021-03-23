const Http = require('./Http')
const HttpServer = require('./HttpServer')
const WebSocket = require('./WebSocket')
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
// const ElasticTranscoder = require('./ElasticTranscoder')
// const ElasticTranscoderPipeline = require('./ElasticTranscoderPipeline')
// const KinesisAnalytics = require('./KinesisAnalytics')
// const KinesisAnalyticsStream = require('./KinesisAnalyticsStream')
// const KinesisVideo = require('./KinesisVideo')
// const KinesisVideoStream = require('./KinesisVideoStream')
const Kinesis = require('./Kinesis')
const KinesisStream = require('./KinesisStream')
const Lambda = require('./Lambda')
const LambdaFunction = require('./LambdaFunction')
const Mongo = require('./Mongo')
const MongoCollection = require('./MongoCollection')
const ElasticsearchIndex = require('./ElasticsearchIndex')
// const SNS = require('./SNS')
// const SNSTopic = require('./SNSTopic')
const S3 = require('./S3')
const S3Bucket = require('./S3Bucket')
// const Redshift = require('./Redshift')
// const Gremlin = require('./Gremlin')
const Redis = require('./Redis')

const Presidium = {
  Http, HttpServer,
  WebSocket, WebSocketServer,
  Dynamo, DynamoTable, DynamoIndex, DynamoStream,
  Docker, DockerImage, DockerContainer, DockerSwarm, DockerService,
  // ElasticTranscoder, ElasticTranscoderPipeline,
  // KinesisAnalytics, KinesisAnalyticsStream,
  // KinesisVideo, KinesisVideoStream,
  Kinesis, KinesisStream,
  Lambda, LambdaFunction,
  Mongo, MongoCollection,
  ElasticsearchIndex,
  // SNS, SNSTopic,
  S3, S3Bucket,
  // Redshift,
  // Gremlin,
  Redis,
}

module.exports = Presidium
