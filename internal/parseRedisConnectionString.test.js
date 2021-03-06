const Test = require('thunk-test')
const parseRedisConnectionString = require('./parseRedisConnectionString')

module.exports = Test(
  'parseRedisConnectionString', parseRedisConnectionString
).case('redis://localhost:6380/15', {
  host: 'localhost',
  port: 6380,
  db: 15
}).case('redis://127.0.0.1', {
  host: '127.0.0.1',
  port: 6379,
  db: 0,
}).case('redis://127.0.0.1/9', {
  host: '127.0.0.1',
  port: 6379,
  db: 9,
}).case('redis://your-domain.hash.ng.0001.use1.cache.amazonaws.com:6379/0', {
  host: 'your-domain.hash.ng.0001.use1.cache.amazonaws.com',
  port: 6379,
  db: 0,
})
