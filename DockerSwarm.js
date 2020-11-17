const Http = require('./Http')
const HttpAgent = require('./HttpAgent')
const stringifyJSON = require('./internal/stringifyJSON')
const pipe = require('rubico/pipe')
const tap = require('rubico/tap')
const fork = require('rubico/fork')
const switchCase = require('rubico/switchCase')
const get = require('rubico/get')
const thunkify = require('rubico/thunkify')
const identity = require('rubico/x/identity')
const isString = require('rubico/x/isString')

const json = response => response.json()

const text = response => response.text()

/**
 * @name DockerSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerSwarm(address string|{ AdvertiseAddr: string }) -> DockerSwarm
 * // `${ipv6Address}[:${port}]`
 * ```
 */
const DockerSwarm = function (address) {
  if (this == null || this.constructor != DockerSwarm) {
    return new DockerSwarm(address)
  }
  const agent = new HttpAgent({
    socketPath: '/var/run/docker.sock',
  })
  this.http = new Http('http://0.0.0.0/v1.40', { agent })
  this.address = address == null ? '127.0.0.1:2377'
    : typeof address == 'string' ? address
    : address.AdvertiseAddr
  return this
}

/**
 * @name DockerSwarm.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker(address)
 * ```
 */
DockerSwarm.prototype.inspect = function swarmInspect() {
  return this.http.get('/swarm').then(json)
}

/**
 * @name DockerSwarm.prototype.init
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerSwarm(address).init(options? {
 *   ListenAddr: string, // Listen address for inter-manager communication <address|interface>:<port>
 *   DataPathAddr: string, // address or interface for data traffic
 *   DataPathPort: 4789|number, // port number for data traffic
 *   DefaultAddrPool: Array<string>, // specify default subnet pools for global scope networks
 *   ForceNewCluster: boolean, // force create new swarm
 *   SubnetSize: number, // subnet size of networks created from default subnet pool
 *   Spec: SwarmSpec,
 * }) -> output Promise<Object>
 * ```
 */
DockerSwarm.prototype.init = async function swarmInit(options) {
  return this.http.post('/swarm/init', {
    body: stringifyJSON({
      AdvertiseAddr: this.address,
      ListenAddr: this.address,
      ...options,
    }),
  }).then(pipe([
    json,
    switchCase([
      isString,
      fork({ node: identity }),
      identity,
    ]),
  ]))
}

/**
 * @name DockerSwarm.prototype.join
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerSwarm(address string|{
 *   address '127.0.0.1:2377'|string,
 * }).join(
 *   token string,
 *   options? {
 *     availability: 'active'|'pause'|'drain',
 *   },
 * ) -> output Promise<string>
 *
 * DockerSwarm(address).join(options? {
 *   ListenAddr: string, // Listen address for inter-manager communication <address|interface>:<port>
 *   DataPathAddr: string, // address or interface for data traffic
 *   RemoteAddrs: Array<string>, // addresses of manager nodes already participating in the swarm
 * }) -> output Promise<string>
 * ```
 */
DockerSwarm.prototype.join = async function swarmJoin(token, options) {
  return this.http.post('/swarm/join', {
    body: stringifyJSON({
      AdvertiseAddr: this.address,
      ListenAddr: this.address,
      JoinToken: token,
      ...options,
    }),
  }).then(json)
}

/**
 * @name DockerSwarm.prototype.leave
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerSwarm(address).leave(options? { force: boolean }) -> output Promise<string>
 * ```
 */
DockerSwarm.prototype.leave = async function swarmLeave(options) {
  const force = get('force', false)(options)
  return this.http.post(`/swarm/leave?force=${encodeURIComponent(force)}`)
    .then(pipe([
      json,
      tap(({ message }) => {
        if (message.startsWith('You are attempting to leave')) {
          throw new Error(message)
        }
      }),
    ])).catch(error => {
      // looks like node-fetch playing not nicely with the docker API
      // if stuff concerning DockerSwarm starts breaking, investigate this
      if (
        error.name == 'FetchError'
          && error.type == 'invalid-json'
          && error.message.startsWith('invalid json response body')
      ) {
        return { message: 'Left the swarm successfully.' }
      }
      throw error
    })
}

module.exports = DockerSwarm
