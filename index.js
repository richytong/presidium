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
const Mongo = require('./Mongo')
const MongoCollection = require('./MongoCollection')
const MySQL = require('./MySQL')
const MySQLTable = require('./MySQLTable')
const EC2 = require('./EC2')
const EC2Image = require('./EC2Image')
const S3 = require('./S3')
const S3Bucket = require('./S3Bucket')
const Gremlin = require('./Gremlin')
const Redis = require('./Redis')

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
  Mongo, MongoCollection,
  MySQL, MySQLTable,
  EC2, EC2Image,
  S3, S3Bucket,
  Gremlin,
  Redis,
}

module.exports = Presidium
