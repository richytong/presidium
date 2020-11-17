const DockerSwarm = require('./DockerSwarm')

/**
 * @name DockerService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService(
 *   address: string|{ AdvertiseAddr: string },
 *   name: string,
 * ) -> DockerService
 * ```
 */
const DockerService = function (address, name, options) {
  if (this == null || this.constructor != DockerService) {
    return new DockerService(address, name)
  }
  const swarm = new DockerSwarm(address)
  this.address = swarm.address
  this.http = swarm.http
  return this
}

/**
 * @namae DockerService.prototype.create
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(address, name)
 *   .task(image string, replicas number, options? {
 *     Mounts: Docker.Volume,
 *   })
 * ```
 */
DockerService.prototype.task = function task(image, replicas, options) {
  return this
}
