const Http = require('./Http')
const HttpServer = require('./HttpServer')
const WebSocket = require('./WebSocket')
const WebSocketServer = require('./WebSocketServer')
const Docker = require('./Docker')
const DockerContainer = require('./DockerContainer')
const DockerService = require('./DockerService')
const Redis = require('./Redis')
const RedisString = require('./RedisString')
const RedisList = require('./RedisList')
const RedisSet = require('./RedisSet')
const RedisHash = require('./RedisHash')
const RedisSortedSet = require('./RedisSortedSet')
const RedisBitmap = require('./RedisBitmap')
const RedisHyperLogLog = require('./RedisHyperLogLog')
const RedisStream = require('./RedisStream')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')
const DynamoIndex = require('./DynamoIndex')
const DynamoStream = require('./DynamoStream')
const ElasticTranscoder = require('./ElasticTranscoder')
const ElasticTranscoderPipeline = require('./ElasticTranscoderPipeline')
const CloudFront = require('./CloudFront')
const CloudFrontDistribution = require('./CloudFrontDistribution')
const Elasticsearch = require('./Elasticsearch')
const ElasticsearchIndex = require('./ElasticsearchIndex')
const PostgreSQL = require('./PostgreSQL')
const PostgreSQLTable = require('./PostgreSQLTable')
const Redshift = require('./Redshift')
const RedshiftTable = require('./RedshiftTable')
const Kinesis = require('./Kinesis')
const KinesisStream = require('./KinesisStream')
const Lambda = require('./Lambda')
const LambdaFunction = require('./LambdaFunction')
const Gremlin = require('./Gremlin')
const GremlinGraph = require('./GremlinGraph')
const Mongo = require('./Mongo')
const MongoTable = require('./MongoTable')
const EC2 = require('./EC2')
const EC2Image = require('./EC2Image')
const S3 = require('./S3')
const S3Bucket = require('./S3Bucket')

const Presidium = {
  Http, HttpServer,
  WebSocket, WebSocketServer,
  Dynamo, DynamoTable, DynamoIndex, DynamoStream,
  Docker, DockerImage, DockerContainer, DockerSwarm, DockerService,
  ElasticTranscoder, ElasticTranscoderPipeline,
  CloudFront, CloudFrontDistribution,
  Elasticsearch, ElasticsearchIndex,
  PostgreSQL, PostgreSQLTable,
  Redshift, RedshiftTable,
  Kinesis, KinesisStream,
  Lambda, LambdaFunction,
  MySQL, MySQLTable,
  Mongo, MongoTable,
  EC2, EC2Image,
  S3, S3Bucket,
  Gremlin,
  Redis,
}

module.exports = Presidium
