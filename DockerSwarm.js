const Docker = require('./Docker')
const stringifyJSON = require('./internal/stringifyJSON')
const get = require('rubico/get')
const querystring = require('querystring')

/**
 * @name DockerSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerSwarm(address? string|{ AdvertiseAddr: string }) -> DockerSwarm
 * // `${ipv6Address}[:${port}]`
 * ```
 */
const DockerSwarm = function (address) {
  if (this == null || this.constructor != DockerSwarm) {
    return new DockerSwarm(address)
  }
  this.http = new Docker().http
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
DockerSwarm.prototype.inspect = function dockerSwarmInspect() {
  return this.http.get('/swarm')
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
DockerSwarm.prototype.init = async function dockerSwarmInit(options) {
  return this.http.post('/swarm/init', {
    body: stringifyJSON({
      AdvertiseAddr: this.address,
      ListenAddr: this.address,
      ...options,
    }),
  })
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
DockerSwarm.prototype.join = async function dockerSwarmJoin(token, options) {
  return this.http.post('/swarm/join', {
    body: stringifyJSON({
      AdvertiseAddr: this.address,
      ListenAddr: this.address,
      JoinToken: token,
      ...options,
    }),
  })
}

/**
 * @name DockerSwarm.prototype.leave
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerSwarm(address).leave(options? { force: boolean }) -> output Promise<string>
 * ```
 */
DockerSwarm.prototype.leave = async function dockerSwarmLeave(options) {
  const force = get('force', false)(options)
  return this.http.post(`/swarm/leave?${querystring.stringify({ force })}`)
}

module.exports = DockerSwarm
