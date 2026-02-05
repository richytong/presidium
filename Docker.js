require('rubico/global')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const size = require('rubico/x/size')
const defaultsDeep = require('rubico/x/defaultsDeep')
const Transducer = require('rubico/Transducer')
const zlib = require('zlib')
const http = require('http')
const Readable = require('./Readable')
const HTTP = require('./HTTP')
const Archive = require('./Archive')
const querystring = require('querystring')
const split = require('./internal/split')
const join = require('./internal/join')
const isArray = require('./internal/isArray')
const pathJoin = require('./internal/pathJoin')
const has = require('./internal/has')
const filterExists = require('./internal/filterExists')
const createUpdateServiceSpec = require('./internal/createUpdateServiceSpec')
const handleDockerHTTPResponse = require('./internal/handleDockerHTTPResponse')

/**
 * @name Docker
 *
 * @docs
 * ```coffeescript [specscript]
 * new Docker() -> docker Docker
 * ```
 *
 * Presidium Docker client for [Docker](https://docs.docker.com/reference/).
 *
 * Note: the Presidium Docker client connects to the Docker socket. Please use caution when creating production services using the Presidium Docker client, see [How would an attacker gain access to the host machine from within a Docker container?](https://www.google.com/search?hl=en&q=how%20would%20an%20attacker%20gain%20access%20to%20the%20host%20machine%20from%20within%20a%20docker%20container).
 */
class Docker {
  constructor() {
    const agent = new http.Agent({
      socketPath: '/var/run/docker.sock',
      maxSockets: Infinity,
    })

    this.http = new HTTP('http://0.0.0.0/v1.48', { agent })
  }

  /**
   * @name auth
   *
   * @docs
   * ```coffeescript [specscript]
   * auth(options {
   *   username: string,
   *   password: string,
   *   email: string,
   *   serveraddress: string,
   * }) -> data Promise<{
   *   Status: string,
   *   IdentityToken: string,
   * }>
   * ```
   *
   * Validates credentials for a Docker container registry. If available, gets an identity token for accessing the registry without password.
   *
   * Arguments:
   *   * `options` - address used for inter-manager communication that is also advertised to other nodes.
   *     * `username` - authentication credentials.
   *     * `password` - authentication credentials.
   *     * `email` - authentication credentials.
   *     * `serveraddress` - domain or IP of the registry server.
   *
   * Return:
   *   * `data`
   *     * `Status` - the status message of the authentication
   *     * `IdentityToken` - a token used to authenticate the user in place of a username and password.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.auth({
   *   username: 'admin',
   *   password: 'password',
   *   email: 'test@example.com',
   *   serveraddress: 'localhost:5000',
   * })
   * ```
   */
  async auth(options) {
    const response = await this.http.post('/auth', {
      headers: {
        'Content-Type': 'application/json',
      },
      body: pipe(options, [
        pick(['username', 'password', 'email', 'serveraddress', 'identitytoken']),
        JSON.stringify,
      ]),
    })

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name listImages
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * listImages() -> data Promise<[
   *   Id: string,
   *   ParentId: string,
   *   RepoTags: Array<string>,
   *   RepoDigests: Array<string>,
   *   Created: string, # timestamp in seconds
   *   Size: number, # bytes
   *   SharedSize: number, # bytes
   *   Labels: Object<string>,
   *   Containers: number,
   *   Manifests: Array<DockerDocs.ImageManifestSummary>,
   *   Descriptor: DockerDocs.OCIDescriptor,
   * ]>
   * ```
   *
   * Returns a list of Docker images stored on the server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `Id` - the image ID.
   *     * `ParentId` - ID of the parent image.
   *     * `RepoTags` - list of image names and tags in the local image cache that reference the image.
   *     * `RepoDigests` - list of content-addressable digests of locally available image manifests that the image is referenced from.
   *     * `Created` - the date and time at which the image was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Size` - the total size in bytes of the image including all layers that the image is composed of.
   *     * `SharedSize` - total size of image layers that are shared between the image and other images. `-1` indicates that this value has not been calculated.
   *     * `Labels` - object of user-defined key/value metadata.
   *     * `Containers` - number of containers using this image. Includes both stopped and running containers. `-1` indicates that this value has not been calculated.
   *     * `Manifests` - list of [image manifests](https://docs.docker.com/reference/cli/docker/manifest/) available in the image. Warning: `Manifests` is experimental and may change at any time without any backward compatibility.
   *     * `Descriptor` - an object containing digest, media type, and size for the image, as defined in the [OCI Content Descriptors Specification](https://github.com/opencontainers/image-spec/blob/v1.0.1/descriptor.md).
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.listImages()
   * ```
   */
  async listImages() {
    const response = await this.http.get('/images/json')
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name listContainers
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * listContainers() -> data Promise<[
   *   Id: string,
   *   Names: Array<string>,
   *   Image: string,
   *   ImageID: string,
   *   ImageManifestDescriptor: DockerDocs.OCIDescriptor,
   *   Command: string,
   *   Created: string, # timestamp in seconds
   *   Ports: DockerDocs.PortSummary,
   *   SizeRw: number,
   *   SizeRootFs: number,
   *   Labels: Object<string>,
   *   State: 'created'|'running'|'paused'|'restarting'|'exited'|'removing'|'dead',
   *   Status: string,
   *   HostConfig: {
   *     NetworkMode: string,
   *     Annotations: Object<string>,
   *   },
   *   NetworkSettings: {
   *     Networks: Object<DockerDocs.EndpointSettings>,
   *   },
   *   Mounts: Array<DockerDocs.MountPoint>,
   *   Health: {
   *     Status: 'none'|'starting'|'healthy'|'unhealthy',
   *     FailingStreak: number,
   *   },
   * ]>
   * ```
   *
   * Returns a list of Docker containers on the server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `Id` - the Docker container ID
   *     * `Names` - the names associated with the Docker container.
   *     * `Image` - the name or ID of the image used to create the Docker container.
   *     * `ImageID` - the ID of the image used to create the Docker container.
   *     * `ImageManifestDescriptor` - an object containing digest, media type, and size for the image used to create the Docker container, as defined in the [OCI Content Descriptors Specification](https://github.com/opencontainers/image-spec/blob/v1.0.1/descriptor.md).
   *     * `Command` - the command to run when starting the Docker container.
   *     * `Created` - the date and time at which the image was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Ports` - port-mappings for the Docker container.
   *     * `SizeRw` - the size of files that have been created or changed by the Docker container.
   *     * `SizeRootFs` - the total size of all files in the read-only layers of the image that are used by the Docker container.
   *     * `Labels` - object of user-defined key/value metadata.
   *     * `State` - the state of the Docker container.
   *     * `Status` - additional human-readable status of the Docker container, e.g. `'Exit 0'`.
   *     * `HostConfig` - summary of host-specific runtime information of the Docker container.
   *     * `NetworkSettings` - summary of the Docker container's network settings.
   *     * `Mounts` - list of mounts used by the Docker container.
   *     * `Health` - summary of the Docker container's health status.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.listContainers()
   * ```
   */
  async listContainers() {
    const response = await this.http.get('/containers/json')
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name pullImage
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * pullImage(
   *   name string,
   *   options {
   *     repo: string,
   *     tag: string,
   *     message: string,
   *     platform: string, # '<os>[/arch[/variant]]'
   *     username: string,
   *     password: string,
   *     email: string,
   *     serveraddress: string,
   *     identitytoken: string,
   *   },
   * ) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Pulls or imports a Docker image to the server.
   *
   * Arguments:
   *   * `name` - name of the image to pull. May include a tag or digest.
   *   * `options`
   *     * `repo` - repository name given to the image after it is pulled. May include a tag or digest.
   *     * `tag` - the tag or digest of the image.
   *     * `message` - sets the commit message for the pulled image.
   *     * `platform` - the platform of the image. If present, the Docker daemon checks if the given image is present in the local image cache with the given OS and Architecture instead of the host's native OS and Architecture. If the given image does exist in the local image cache, but its OS and Architecture do not match, a warning is produced.
   *     * `username` - authentication credentials.
   *     * `password` - authentication credentials.
   *     * `email` - authentication credentials.
   *     * `serveraddress` - domain or IP of the registry server.
   *     * `identitytoken` - a token used to authenticate the user in place of a username and password.
   *
   * Return:
   *   * `dataStream` - a readable stream of the progress of the Docker `pullImage` operation.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const pullStream = await docker.pullImage('nginx:1.19')
   *
   * pullStream.pipe(process.stdout)
   * pullStream.on('end', () => {
   *   console.log('pullImage success')
   * })
   * ```
   */
  async pullImage(name, options = {}) {
    const response = await this.http.post(`/images/create?${querystring.stringify({
      fromImage: name,
      ...pick(['repo', 'tag', 'message', 'platform'])(options),
    })}`, {
      headers: {
        'X-Registry-Auth': pipe(options, [
          pick([
            'username',
            'password',
            'email',
            'serveraddress',
            'identitytoken',
          ]),
          JSON.stringify,
          Buffer.from,
          buffer => buffer.toString('base64'),
        ]),
      },
    })

    const dataStream = await handleDockerHTTPResponse(response, { stream: true })
    return dataStream
  }

  /**
   * @name buildImage
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * buildImage(path string, options {
   *   image: string,
   *   ignore: Array<string>,
   *   archive: Object<
   *     Dockerfile: content string,
   *     [filepath string]: content string,
   *     ...
   *   >,
   *   archiveDockerfile: string,
   *   platform: string, # '<os>[/arch[/variant]]'
   * }) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Builds a Docker Image.
   *
   * Arguments:
   *   * `path` - parent directory of the build context.
   *   * `options`
   *     * `image` - the name and optional tag of the image. If no tag is present, `'LATEST'` is assumed as the value for the tag.
   *     * `ignore` - filepaths or filenames to ignore when bundling files and directories for the build context.
   *     * `archive` - an object of filenames and file contents that will be present in the build context.
   *     * `archiveDockerfile` - the filepath including filename of the Dockerfile, e.g. `'Dockerfiles/Dockerfile2'`. Defaults to `'Dockerfile'`.
   *     * `platform` - target platform for the build, e.g. `'linux/arm64'`.
   *
   * Return:
   *   * `dataStream` - a readable stream of the progress of the Docker `buildImage` operation.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const buildStream = await docker.buildImage(__dirname, {
   *   image: 'my-image',
   *   archive: {
   *     Dockerfile: `
   * FROM node:15-alpine
   * RUN apk add openssh neovim
   * EXPOSE 8080
   *     `,
   *   },
   * })
   *
   * buildStream.pipe(process.stdout)
   * buildStream.on('end', () => {
   *   console.log('Build success')
   * })
   * ```
   *
   * ### Dockerfile Syntax
   * ```sh
   * HEALTHCHECK \
   *   [--interval=<duration '30s'|string>] \
   *   [--timeout=<duration '30s'|string>] \
   *   [--start-period=<duration '0s'|string>] \
   *   [--start-interval=<duration '5s'|string>] \
   *   [--retries=<3|number>]
   *
   * ENV <key>=<value> ...
   *
   * EXPOSE <port>/<protocol 'tcp'|'udp'> ...
   *
   * WORKDIR <path>
   *
   * VOLUME ["<path>", ...]
   * VOLUME <path> ...
   *
   * USER <user>[:<group>]|<UID>[:<GID>]
   *
   * ENTRYPOINT ["<command>", "<parameter>", ...]
   * ENTRYPOINT <command> <parameter> ...
   *
   * CMD ["<command>", "<parameter>", ...]
   * CMD ["<parameter>", ...]
   * CMD <command> <parameter> ...
   * ```
   *
   * References:
   *   * [Dockerfile](https://docs.docker.com/engine/reference/builder/)
   */
  async buildImage(path, options = {}) {
    const archive = new Archive(options.archive)

    const pack = archive.tar(path, {
      ignore: options.ignore ?? ['node_modules', '.git', '.nyc_output'],
    })

    const compressed = pack.pipe(zlib.createGzip())

    const response = await this.http.post(`/build?${querystring.stringify({
      dockerfile: options.archiveDockerfile ?? 'Dockerfile',
      t: options.image,
      forcerm: true,
      platform: options.platform ?? '',
    })}`, {
      body: compressed,
      headers: {
        'Content-Type': 'application/x-tar',
      },
    })

    const dataStream = await handleDockerHTTPResponse(response, { stream: true })
    return dataStream
  }

  /**
   * @name pushImage
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * pushImage(options {
   *   image: string, # '[<repo>/]<name>:<tag>'
   *   registry: string,
   *   authToken: string,
   *   username: string,
   *   password: string,
   *   email: string,
   *   serveraddress: string,
   *   identitytoken: string,
   * }) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Pushes a Docker image to a registry.
   *
   * Arguments:
   *   * `options`
   *     * `image` - the name, optional repo, and tag of the image.
   *     * `registry` - the remote registry to which to push the image.
   *     * `authToken` - a base64-encoded token containing the username and password authentication credentials. Returned from [ECR getAuthorizationToken](/docs/ECR#getAuthorizationToken).
   *     * `username` - authentication credentials.
   *     * `password` - authentication credentials.
   *     * `email` - authentication credentials.
   *     * `serveraddress` - domain or IP of the registry server.
   *     * `identitytoken` - a token used to authenticate the user in place of a username and password.
   *
   * Return:
   *   * `dataStream` - a readable stream of the progress of the Docker `pushImage` operation.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const dataStream = await docker.pushImage({
   *   image: 'repo/my-image:mytag',
   *   registry: 'my-registry.io',
   * })
   * dataStream.pipe(process.stdout)
   * dataStream.on('end', () => {
   *   console.log('Push success')
   * })
   * ```
   *
   */
  async pushImage(options = {}) {
    const authOptions = pick(options, [
      'username',
      'password',
      'email',
      'serveraddress',
      'identitytoken'
    ])

    if (options.authToken) {
      const decoded = Buffer.from(options.authToken, 'base64').toString('utf8')
      const [username, password] = decoded.split(':')
      authOptions.username = username
      authOptions.password = password
    }

    const headers = {
      'X-Registry-Auth':
        Buffer.from(JSON.stringify(authOptions)).toString('base64')
    }

    const [name, tag] = options.image.split(':')
    const remoteImageName = `${options.repository ?? options.registry}/${name}`
    const queryParams = `tag=${encodeURIComponent(tag)}`

    const response = await this.http.post(
      `/images/${remoteImageName}/push?${queryParams}`,
      { headers }
    )

    const dataStream = await handleDockerHTTPResponse(response, { stream: true })
    return dataStream
  }

  /**
   * @name inspectImage
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * inspectImage(image string) -> data Promise<{
   *   Id: string,
   *   Descriptor: DockerDocs.OCIDescriptor,
   *   Manifests: Array<Manifest DockerDocs.ImageManifestSummary>,
   *   RepoTags: Array<string>,
   *   RepoDigests: Array<string>,
   *   Comment: string,
   *   Created: string, # timestamp in seconds
   *   Author: string,
   *   Config: DockerDocs.ImageConfig,
   *   Architecture: string,
   *   Variant: string,
   *   Os: string,
   *   OsVersion: string,
   *   Size: number, # bytes
   *   GraphDriver: DockerDocs.DriverData,
   *   RootFS: {
   *     Type: string,
   *     Layers: Array<string>,
   *   },
   *   Metadata: {
   *     LastTagTime: string, # timestamp in seconds
   *   },
   * }>
   * ```
   *
   * Returns low-level information about a Docker image.
   *
   * Arguments:
   *   * `image` - the name or ID of the image to inspect
   *
   * Return:
   *   * `data`
   *     * `Id` - the content-addressable ID of an image.
   *     * `Descriptor` - an object containing digest, media type, and size for the image, as defined in the [OCI Content Descriptors Specification](https://github.com/opencontainers/image-spec/blob/v1.0.1/descriptor.md).
   *     * `Manifests` - list of [image manifests](https://docs.docker.com/reference/cli/docker/manifest/) available in the image. Warning: `Manifests` is experimental and may change at any time without any backward compatibility.
   *     * `RepoTags` - list of image names and tags in the local image cache that reference the image.
   *     * `RepoDigests` - list of content-addressable digests of locally available image manifests that the image is referenced from.
   *     * `Comment` - optional message that was set when committing or importing the image.
   *     * `Created` - the date and time at which the image was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Author` - the name of the author that was specified when committing the image.
   *     * `Config` - the configuration of the image. `Config` fields are used as defaults when starting a container from an image.
   *     * `Architecture` - the CPU architecture that the image runs on.
   *     * `Variant` - a CPU architecture variant.
   *     * `Os` - the operating system that the image is built to run on.
   *     * `OsVersion` - the version of the operating system that the image is built to run on.
   *     * `Size` - the total size in bytes of the image including all layers that the image is composed of.
   *     * `GraphDriver` - information about the storage driver that stores the filesystem used by the Docker container and the image.
   *     * `RootFS` - information about the image's RootFS, including the layer IDs.
   *     * `Metadata` - additional metadata of the image in the local cache. This information is not part of the image itself.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.inspectImage('my-image:example')
   * ```
   */
  async inspectImage(image) {
    const response = await this.http.get(`/images/${image}/json`)
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name tagImage
   *
   * @docs
   * ```coffeescript [specscript]
   * tagImage(
   *   sourceImageTag string, # '[<repo>/]<image>:<tag>'
   *   targetImageTag string, # '[<repo>/]<image>:<tag>'
   * ) -> data Promise<{}>
   * ```
   *
   * Creates a Docker image tag that refers to a source Docker image tag.
   *
   * Arguments:
   *   * `sourceImageTag` - the source Docker image tag
   *   * `targetImageTag` - the Docker image tag to create
   *
   * Return:
   *   * `data` - empty object.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.tagImage('my-image:example', 'my-registry/my-image:example')
   * ```
   */
  async tagImage(sourceImageTag, targetImageTag) {
    const targetImageTagParts = targetImageTag.split(':')
    const tag = targetImageTagParts[targetImageTagParts.length - 1]
    const repo = targetImageTagParts.slice(0, -1).join(':')
    const response = await this.http.post(`
/images/${sourceImageTag}/tag?${querystring.stringify({ repo, tag })}
    `.trim())
    await handleDockerHTTPResponse(response, { text: true })
    return {}
  }

  /**
   * @name removeImage
   *
   * @docs
   * ```coffeescript [specscript]
   * removeImage(image string, options? {
   *   force: boolean,
   *   noprune: boolean,
   * }) -> data Promise<Array<{ Untagged: string }|{ Deleted: string }>>
   * ```
   *
   * Removes a Docker image and any untagged parent images that were referenced by the Docker image from the server. Docker images can't be removed if they have descendant images, are being used by a running container, or are being used by a build.
   *
   * Arguments:
   *   * `image` - the name or ID of the image to remove.
   *   * `options`
   *     * `force` - if `true`, removes the image even if it is being used by stopped containers or has other tags. If `false`, the operation will error if the image is being used by stopped containers. Defaults to `false`.
   *     * `noprune` - if `true`, the operation will not delete untagged parent images. If `false`, the operation will delete untagged parent images. Defaults to `false`.
   *
   * Return:
   *   * `data`
   *     * `Untagged` - the image ID of an image that was untagged.
   *     * `Deleted` - the image ID of an image that was deleted.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.removeImage('my-image:example')
   * ```
   */
  async removeImage(image, options = {}) {
    const response = await this.http.delete(`/images/${image}?${
      querystring.stringify(pick(options, ['force', 'noprune']))
    }`)

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name createContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * createContainer(options {
   *   name: string,
   *   image: string,
   *   rm: boolean,
   *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
   *   logDriver: 'local'|'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'etwlogs'|'none',
   *   logDriverOptions: Object<string>,
   *   publish: Object<
   *     [hostPort string]: containerPort string # 8080
   *       |containerPortWithProtocol string # '<containerPort>[/<"tcp"|"udp"|"sctp">]'
   *   >,
   *   healthCmd: Array<string>,
   *   healthInterval: number, # nanoseconds, minimum 1e6, default 10e9
   *   healthTimeout: number, # nanoseconds, minimum 1e6, default 20e9
   *   healthRetries: number, # default 5
   *   healthStartPeriod: number, # nanoseconds, minimum 1e6
   *   memory: number, # bytes
   *   cpus: number,
   *   mounts: Array<{
   *     source: string,
   *     target: string,
   *     readonly: boolean,
   *     type: 'bind'|'cluster'|'image'|'npipe'|'tmpfs'|'volume',
   *   }>|Array<
   *     mount string, # '<source>:<target>[:<readonly true|false>]'
   *   >,
   *
   *   # Dockerfile defaults
   *   cmd: Array<string|number>,
   *   expose: Array<port string>, # '<port>[/<"tcp"|"udp"|"sctp">]'
   *   volume: Array<path string>,
   *   workdir: path string,
   *   env: Object<string>,
   * }) -> data Promise<{
   *   Id: string,
   *   Warnings: Array<string>,
   * }>
   * ```
   *
   * Creates a Docker container.
   *
   * Arguments:
   *   * `options`
   *     * `name` - the name that will be assigned to the Docker container.
   *     * `image` - the name and tag of the image.
   *     * `rm` - automatically remove the Docker container when it exits.
   *     * `restart` - the restart policy for the Docker container.
   *     * `logDriver` - the logging driver used for the Docker container.
   *     * `logDriverOptions` - driver-specific configuration options for the logging driver.
   *     * `publish` - object of mappings of host ports to container ports with optional protocols.
   *     * `healthCmd` - a command that checks the health of the Docker container. The health check fails if the command errors. The command is run inside the Docker container.
   *     * `healthInterval` - time in nanoseconds to wait between healthchecks.
   *     * `healthTimeout` - time in nanoseconds to wait before the healthcheck fails.
   *     * `healthRetries` - number of times to retry the health check before the Docker container is considered unhealhty.
   *     * `healthStartPeriod` - time in nanoseconds to wait when the Docker container starts up before running the first health check command.
   *     * `memory` - memory limit of the Docker container in bytes.
   *     * `cpus` - CPU quota in CPUs.
   *     * `mounts` - specification of the Docker container's volumes or mounts
   *       * `source` - the mount source (e.g. a volume name or a host path).
   *       * `target` - the mounted path inside the Docker container.
   *       * `readonly`- if `true`, the mount is read-only. If `false`, the mount is writable. Defaults to `false`.
   *       * `type` - the mount type.
   *     * `cmd` - the command that is run by the Docker container.
   *     * `expose` - an array of ports with optional protocols that the Docker container exposes.
   *     * `volume` - an array of mount point paths inside the Docker container.
   *     * `workdir` - the working directory of the Docker container.
   *     * `env` - an object of the Docker container's environment variables. Maps environment variable names to environment variable values, e.g. `{ FOO: 'bar' }`.
   *
   * Return:
   *   * `data`
   *     * `Id` - the ID of the Docker container.
   *     * `Warnings` - warnings encountered when creating the Docker container.
   *
   * Restart policies:
   *   * `no` - do not restart the Docker container when it exits
   *   * `on-failure` - restart only if container exits with non-zero exit code
   *   * `always` - always restart container regardless of exit code
   *   * `unless-stopped` - like `always` except if the Docker container was put into a stopped state before the Docker daemon was stopped
   *
   * Health checks:
   *   * `[]` - inherit healthcheck from image or parent image
   *   * `['NONE']` - disable healthcheck
   *   * `['CMD', ...args]` - exec arguments directly
   *   * `['CMD-SHELL', command string]` - run command with system's default shell
   *
   * Mount types:
   *   * `bind` - mounts a file or directory from the host into the Docker container. The `source` must exist prior to creating the Docker container.
   *   * `cluster` - a Docker Swarm cluster volume.
   *   * `image` - mounts a Docker image.
   *   * `npipe` - mounts a named pipe from the host into the Docker container.
   *   * `tmpfs` - create a tmpfs with the given options. The `source` cannot be specified with mount type `tmpfs`.
   *   * `volume` - creates a volume with the given name and options or uses a pre-existing volume with the same name and options. The volume persists when the Docker container is removed.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', 'console.log(\'Hello World.\')'],
   *   rm: true,
   * })
   * ```
   *
   */
  async createContainer(options) {
    const response = await this.http.post(`/containers/create?${
      querystring.stringify({
        ...options.name && { name: options.name },
      })
    }`, {
      body: JSON.stringify({
        AttachStderr: true,
        AttachStdout: true,
        AttachStdin: false,
        Tty: false,
        Image: options.image,

        ...options.cmd && { Cmd: options.cmd },
        ...options.env && {
          Env: Object.entries(options.env)
            .map(([key, value]) => `${key}=${value}`),
        },
        ...options.expose && {
          ExposedPorts: transform(options.expose, Transducer.map(pipe([
            String,
            split('/'),
            all([get(0), get(1, 'tcp')]),
            join('/'),
            port => ({ [port]: {} }),
          ])), {}),
        },
        ...options.workdir && {
          WorkingDir: options.workdir,
        },
        ...options.volume && {
          Volumes: transform(
            options.volume,
            Transducer.map(path => ({ [path]: {} })),
            {},
          ),
        },

        ...options.healthCmd && {
          Healthcheck: { // note: this is correct versus the healthCmd in createService, which is HealthCheck
            Test: ['CMD', ...options.healthCmd],
            ...all({
              Interval: get('healthInterval', 10e9),
              Timeout: get('healthTimeout', 20e9),
              Retries: get('healthRetries', 5),
              StartPeriod: get('healthStartPeriod', 1e6),
            })(options),
          },
        },

        HostConfig: {
          ...options.mounts && {
            Mounts: options.mounts.map(pipe([
              switchCase([
                isString,
                pipe([
                  split(':'),
                  all({ target: get(0), source: get(1), readonly: get(2) }),
                ]),
                identity,
              ]),
              all({
                Target: get('target'),
                Source: get('source'),
                Type: get('type', 'volume'),
                ReadOnly: get('readonly', false),
              }),
            ]))
          },

          ...options.memory && { Memory: options.memory },
          ...options.cpus && { NanoCpus: options.cpus * 1e9 },

          ...options.publish && {
            PortBindings: map.entries(all([ // publish and PortBindings are reversed
              pipe([ // container port
                get(1),
                String,
                split('/'),
                all([get(0), get(1, 'tcp')]),
                join('/'),
              ]),
              pipe([ // host port
                get(0),
                String,
                HostPort => [{ HostPort }],
              ]),
            ]))(options.publish),
          },

          ...options.logDriver && {
            LogConfig: {
              Type: options.logDriver,
              Config: { ...options.logDriverOptions },
            },
          },
          ...options.restart && {
            RestartPolicy: all({
              Name: get(0, 'no'),
              MaximumRetryCount: pipe([get(1, 0), Number]),
            })(options.restart.split(':')),
          },
          ...options.rm && { AutoRemove: options.rm },

        },
      }),

      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name attachContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * attachContainer(containerId string, options {
   *   stdout: boolean,
   *   stderr: boolean,
   * }) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Attaches to a Docker container.
   *
   * Arguments:
   *   * `containerId` - the ID of the Docker container.
   *   * `options`
   *     * `stdout` - if `true`, `attachContainer` attaches to the Docker container's `stdout`. If `false`, `attachContainer` does not attach to the Docker container's `stdout`. Defaults to `true`.
   *     * `stderr` - if `true`, `attachContainer` attaches to the Docker container's `stderr`. If `false`, `attachContainer` does not attach to the Docker container's `stderr`. Defaults to `true`.
   *
   * Return:
   *   * `dataStream` - a readable stream of the Docker container's `stdout` and/or `stderr`.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', 'console.log(\'Hello World.\')'],
   *   rm: true,
   * })
   * const containerId = data.Id
   *
   * const attachStream = await docker.attachContainer(containerId)
   * attachStream.pipe(process.stdout) // Hello World.
   * attachStream.on('end', () => {
   *   console.log('Attach success')
   * })
   *
   * await docker.startContainer(containerId)
   * ```
   */
  async attachContainer(containerId, options = {}) {
    const response = await this.http.post(`/containers/${containerId}/attach?${
      querystring.stringify({
        stream: true,
        stdout: Boolean(options.stdout ?? true),
        stderr: Boolean(options.stderr ?? true),
      })
    }`)
    const dataStream = await handleDockerHTTPResponse(response, { stream: true })
    return dataStream
  }

  /**
   * @name runContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * runContainer(options {
   *   name: string,
   *   image: string,
   *   rm: boolean,
   *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
   *   logDriver: 'local'|'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'etwlogs'|'none',
   *   logDriverOptions: Object<string>,
   *   publish: Object<
   *     [hostPort string]: containerPort string # 8080
   *       |containerPortWithProtocol string # '<containerPort>[/<"tcp"|"udp"|"sctp">]'
   *   >,
   *   healthCmd: Array<string>,
   *   healthInterval: number, # nanoseconds, minimum 1e6, default 10e9
   *   healthTimeout: number, # nanoseconds, minimum 1e6, default 20e9
   *   healthRetries: number, # default 5
   *   healthStartPeriod: number, # nanoseconds, minimum 1e6
   *   memory: number, # bytes
   *   cpus: number,
   *   mounts: Array<{
   *     source: string,
   *     target: string,
   *     readonly: boolean,
   *     type: 'bind'|'cluster'|'image'|'npipe'|'tmpfs'|'volume',
   *   }>|Array<
   *     mount string, # '<source>:<target>[:<readonly true|false>]'
   *   >,
   *
   *   # Dockerfile defaults
   *   cmd: Array<string|number>,
   *   expose: Array<port string>, # '<port>[/<"tcp"|"udp"|"sctp">]'
   *   volume: Array<path string>,
   *   workdir: path string,
   *   env: Object<string>,
   * }) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Creates, attaches to, and starts a Docker container.
   *
   * Arguments:
   *   * `options`
   *     * `name` - the name that will be assigned to the Docker container.
   *     * `image` - the name and tag of the image.
   *     * `rm` - automatically remove the Docker container when it exits.
   *     * `restart` - the restart policy for the Docker container.
   *     * `logDriver` - the logging driver used for the Docker container.
   *     * `logDriverOptions` - driver-specific configuration options for the logging driver.
   *     * `publish` - object of mappings of host ports to container ports with optional protocols.
   *     * `healthCmd` - a command that checks the health of the Docker container. The health check fails if the command errors. The command is run inside the Docker container.
   *     * `healthInterval` - time in nanoseconds to wait between healthchecks.
   *     * `healthTimeout` - time in nanoseconds to wait before the healthcheck fails.
   *     * `healthRetries` - number of times to retry the health check before the Docker container is considered unhealhty.
   *     * `healthStartPeriod` - time in nanoseconds to wait when the Docker container starts up before running the first health check command.
   *     * `memory` - memory limit of the Docker container in bytes.
   *     * `cpus` - CPU quota in CPUs.
   *     * `mounts` - specification of the Docker container's volumes or mounts
   *       * `source` - the mount source (e.g. a volume name or a host path).
   *       * `target` - the mounted path inside the Docker container.
   *       * `readonly`- if `true`, the mount is read-only. If `false`, the mount is writable. Defaults to `false`.
   *       * `type` - the mount type.
   *     * `cmd` - the command that is run by the Docker container.
   *     * `expose` - an array of ports with optional protocols that the Docker container exposes.
   *     * `volume` - an array of mount point paths inside the Docker container.
   *     * `workdir` - the working directory of the Docker container.
   *     * `env` - an object of the Docker container's environment variables. Maps environment variable names to environment variable values, e.g. `{ FOO: 'bar' }`.
   *
   * Return:
  *   * `dataStream` - a readable stream of the Docker container's `stdout` and/or `stderr`.
   *
   * Restart policies:
   *   * `no` - do not restart the Docker container when it exits
   *   * `on-failure` - restart only if container exits with non-zero exit code
   *   * `always` - always restart container regardless of exit code
   *   * `unless-stopped` - like `always` except if the Docker container was put into a stopped state before the Docker daemon was stopped
   *
   * Health checks:
   *   * `[]` - inherit healthcheck from image or parent image
   *   * `['NONE']` - disable healthcheck
   *   * `['CMD', ...args]` - exec arguments directly
   *   * `['CMD-SHELL', command string]` - run command with system's default shell
   *
   * Mount types:
   *   * `bind` - mounts a file or directory from the host into the Docker container. The `source` must exist prior to creating the Docker container.
   *   * `cluster` - a Docker Swarm cluster volume.
   *   * `image` - mounts a Docker image.
   *   * `npipe` - mounts a named pipe from the host into the Docker container.
   *   * `tmpfs` - create a tmpfs with the given options. The `source` cannot be specified with mount type `tmpfs`.
   *   * `volume` - creates a volume with the given name and options or uses a pre-existing volume with the same name and options. The volume persists when the Docker container is removed.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const dataStream = await docker.runContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', 'console.log(\'Hello World.\')'],
   *   rm: true,
   * })
   *
   * dataStream.pipe(process.stdout) // Hello World.
   * dataStream.on('end', () => {
   *   console.log('Run success')
   * })
   * ```
   *
   */
  async runContainer(options) {
    const createData = await this.createContainer(options)
    const containerId = createData.Id
    const attachDataStream = await this.attachContainer(containerId)
    await this.startContainer(containerId)
    return attachDataStream
  }

  /**
   * @name execContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * execContainer(
   *   containerId string,
   *   cmd Array<string>
   * ) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Runs a command inside a running Docker container.
   *
   * Arguments:
   *   * `containerId` - the ID of the Docker container.
   *   * `cmd` - the command to be run by the running Docker container.
   *
   * Return:
   *   * `dataStream` - a readable stream of the Docker exec instance's `stdout` and `stderr`.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', 'setTimeout(() => {}, 500)'],
   *   rm: true,
   * })
   *
   * const containerId = data.Id
   *
   * await docker.startContainer(containerId)
   * const execDataStream = await docker.execContainer(
   *   containerId,
   *   ['node', '-e', 'console.log(\'Hello from Exec.\')']
   * )
   *
   * execDataStream.pipe(process.stdout) // Hello from Exec.
   * execDataStream.on('end', () => {
   *   console.log('Exec success.')
   * })
   * ```
   */
  async execContainer(containerId, cmd) {
    const execResponse = await this.http.post(`/containers/${containerId}/exec`, {
      body: JSON.stringify({
        AttachStdin: false,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        Cmd: cmd,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const execData = await handleDockerHTTPResponse(execResponse)
    const execId = execData.Id

    const startResponse = await this.http.post(`/exec/${execId}/start`, {
      body: JSON.stringify({ Detach: false, Tty: false }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const dataStream = await handleDockerHTTPResponse(startResponse, { stream: true })
    return dataStream
  }

  /**
   * @name startContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * startContainer(containerId string) -> message string
   * ```
   *
   * Starts a Docker container.
   *
   * Arguments:
   *   * `containerId` - the ID of the Docker container.
   *
   * Return:
   *   * `message` - the start message.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', `
   * const server = http.createServer((request, response) => {
   *   request.pipe(response)
   *   request.on('end', () => {
   *     response.end()
   *     server.close()
   *   })
   * })
   * server.listen(8081)
   *   `],
   *   publish: { 8081: '8081' },
   *   expose: ['8081'],
   *   rm: true,
   * })
   * const containerId = data.Id
   *
   * await docker.startContainer(containerId)
   *
   * const http = new HTTP('http://localhost:8081')
   *
   * let response = await http.post('/', {
   *   body: 'Echo Message.',
   * }).catch(() => ({ ok: false }))
   * while (!response.ok) {
   *   response = await http.post('/', {
   *     body: 'Echo Message.',
   *   }).catch(() => ({ ok: false }))
   * }
   *
   * console.log(await Readable.Text(response)) // Echo Message.
   * ```
   */
  async startContainer(containerId) {
    const response = await this.http.post(`/containers/${containerId}/start`)
    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

  /**
   * @name stopContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * stopContainer(containerId string, options? {
   *   time: number, # seconds
   * }) -> message Promise<string>
   * ```
   *
   * Stops a Docker container.
   *
   * Arguments:
   *   * `containerId` - the ID of the Docker container.
   *   * `options`
   *     * `time` - number of seconds to wait before stopping the Docker container.
   *
   * Return:
   *   * `message` - the stop message
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', 'http.createServer(() => {})'],
   *   rm: true,
   * })
   *
   * const containerId = data.Id
   *
   * await docker.startContainer(containerId)
   *
   * await docker.stopContainer(containerId)
   * console.log('Stop success')
   * ```
   */
  async stopContainer(containerId, options = {}) {
    const response = await this.http.post(`/containers/${containerId}/stop?${
      querystring.stringify({
        ...options.time && { t: options.time },
      })
    }`)
    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

  /**
   * @name inspectContainer
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * inspectContainer(containerId string) -> data Promise<{
   *   Id: string,
   *   Created: string, # timestamp in seconds
   *   Path: string,
   *   Args: Array<string>,
   *   State: DockerDocs.ContainerState,
   *   Image: string,
   *   ResolveConfPath: string,
   *   HostnamePath: string,
   *   HostsPath: string,
   *   LogPath: string,
   *   Name: string,
   *   RestartCount: number,
   *   Driver: string,
   *   Platform: string,
   *   ImageManifestDescriptor: DockerDocs.OCIDescriptor,
   *   MountLabel: string,
   *   ProcessLabel: string,
   *   AppArmorProfile: string,
   *   ExecIDs: Array<string>,
   *   HostConfig: DockerDocs.HostConfig,
   *   GraphDriver: DockerDocs.DriverData,
   *   Storage: DockerDocs.Storage,
   *   SizeRw: number,
   *   SizeRootFs: number,
   *   Mounts: Array<DockerDocs.MountPoint>,
   *   Config: DockerDocs.ContainerConfig,
   *   NetworkSettings: DockerDocs.NetworkSettings,
   * }>
   * ```
   *
   * Returns low-level information about a Docker container.
   *
   * Arguments:
   *   * `containerId` - the ID of the Docker container.
   *
   * Return:
   *   * `data`
   *     * `Id` - the ID of the Docker container.
   *     * `Created` - the date and time at which the Docker container was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Path` - the path to the command run by the Docker container.
   *     * `Args` - the arguments to the command being run by the Docker container.
   *     * `State` - `DockerDocs.ContainerState` stores the Docker container's running state.
   *     * `Image` - the ID (digest) of the image that the Docker container was created from.
   *     * `ResolveConfPath` - the location of `/etc/resolve.conf` generated for the Docker container on the host.
   *     * `HostnamePath` - the location of `/etc/hostname` generated for the Docker container on the host.
   *     * `HostsPath` - the location of `/etc/hosts` generated for the Docker container on the host.
   *     * `LogPath` - the location of the file used to buffer the Docker container's logs.
   *     * `Name` - the name associated with the Docker container.
   *     * `RestartCount` - the number of times the Docker container was restarted since it was created or since the Docker daemon was started.
   *     * `Driver` - the storage-driver used for the Docker container's filesystem.
   *     * `Platform` - the platform (operating system) for which the Docker container was created.
   *     * `ImageManifestDescriptor` - an object containing digest, media type, and size for the image from which the Docker container was created, as defined in the [OCI Content Descriptors Specification](https://github.com/opencontainers/image-spec/blob/v1.0.1/descriptor.md).
   *     * `MountLabel` - the SELinux mount label set for the Docker container.
   *     * `ProcessLabel` - the SELinux process label set for the Docker container.
   *     * `AppArmorProfile` - the AppArmor profile set for the Docker container.
   *     * `ExecIDs` - the IDs of exec instances that are running in the Docker container.
   *     * `HostConfig` - host configuration for the Docker container.
   *     * `GraphDriver` - information about the storage driver that stores the filesystem used by the Docker container and the image.
   *     * `Storage` - information about the storage used by the Docker container.
   *     * `SizeRw` - the size of files that have been created or changed by the Docker container.
   *     * `SizeRootFs` - the total size of all files in the read-only layers of the image that are used by the Docker container.
   *     * `Mounts` - list of mounts used by the Docker container.
   *     * `Config` - the configuration of the Docker container.
   *     * `NetworkSettings` - summary of the Docker container's network settings.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createContainer({
   *   image: 'node:15-alpine',
   *   cmd: ['node', '-e', 'http.createServer(() => {})'],
   *   rm: true,
   * })
   *
   * const containerId = data.Id
   *
   * const inspectData = await docker.inspectContainer(containerId)
   * ```
   */
  async inspectContainer(containerId) {
    const response = await this.http.get(`/containers/${containerId}/json`)
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name inspectSwarm
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * inspectSwarm() -> data Promise<{
   *   ID: string,
   *   Version: DockerDocs.ObjectVersion,
   *   CreatedAt: string, # ISO 8601 date string
   *   UpdatedAt: string, # ISO 8601 date string
   *   Spec: DockerDocs.NodeSpec,
   *   TLSInfo: DockerDocs.TLSInfo,
   *   RootRotationInProgress: boolean,
   *   DataPathPort: number,
   *   DefaultAddrPool: Array<CIDR string>,
   *   SubnetSize: integer, # <= 29, default 24
   *   JoinTokens: {
   *     Worker: string,
   *     Manager: string,
   *   },
   * }>
   * ```
   *
   * Inspects a Docker swarm.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `ID` - the ID of the Docker swarm.
   *     * `Version` - the version of the Docker swarm.
   *     * `CreatedAt` - the date and time at which the Docker swarm was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `UpdatedAt` - the date and time at which the Docker swarm was updated as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Spec` - the Docker swarm configuration.
   *     * `TLSInfo` - information about the issuer of the Docker swarm's leaf TLS certificates and the trusted CA certificate.
   *     * `RootRotationInProgress` - if `true`, there is currently a root CA rotation in progress for the swarm. If `false`, there is currently no root CA rotation in progress.
   *     * `DataPathPort` - the data path port number for data traffic of the Docker swarm. Defaults to `4789`.
   *     * `DefaultAddrPool` - the default subnet pools for global scope networks of the Docker swarm.
   *     * `SubnetSize` - the subnet size of the networks created from the default address pool.
   *     * `JoinTokens` - tokens for worker and manager nodes to join the Docker swarm.
   *       * `Worker` - the token that worker nodes can use to join the Docker swarm.
   *       * `Manager` - the token that manager nodes can use to join the Docker swarm.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.initSwarm('[::1]:2377')
   *
   * const data = await docker.inspectSwarm()
   * ```
   */
  async inspectSwarm() {
    const response = await this.http.get('/swarm')
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name initSwarm
   *
   * @docs
   * ```coffeescript [specscript]
   * initSwarm(address string) -> nodeId string
   * ```
   *
   * Initializes a new Docker swarm.
   *
   * Arguments:
   *   * `address` - address used for inter-manager communication that is also advertised to other nodes.
   *
   * Return:
   *   * `nodeId` - the ID of the current Docker swarm manager node.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.initSwarm('[::1]:2377')
   * ```
   */
  async initSwarm(address) {
    const response = await this.http.post('/swarm/init', {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AdvertiseAddr: address,
        ListenAddr: address,
      }),
    })

    const nodeId = await handleDockerHTTPResponse(response, { text: true })
    return nodeId
  }

  /**
   * @name joinSwarm
   *
   * @docs
   * ```coffeescript [specscript]
   * joinSwarm(address string, options {
   *   RemoteAddrs: Array<string>,
   *   JoinToken: string,
   * }) -> message Promise<string>
   * ```
   *
   * Joins the current node (server) to a Docker swarm.
   *
   * Arguments:
   *   * `address` - address used for inter-manager communication that is also advertised to other nodes.
   *   * `options`
   *     * `RemoteAddrs` - address or interface for data path traffic. Used to separate data traffic from management traffic.
   *     * `JoinToken` - worker or manager token for joining the swarm.
   *
   * Return:
   *   * `message` - the message from joining the Docker swarm.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const workerJoinToken = 'token'
   *
   * await docker.joinSwarm('[::1]:2377', {
   *   RemoteAddrs: ['ip-102-30-0-70.ec2.internal'],
   *   JoinToken: workerJoinToken,
   * })
   * ```
   */
  async joinSwarm(address, options) {
    const response = await this.http.post('/swarm/join', {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ListenAddr: address,
        AdvertiseAddr: address,
        RemoteAddrs: options.RemoteAddrs,
        JoinToken: options.JoinToken,
      }),
    })

    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

  /**
   * @name leaveSwarm
   *
   * @docs
   * ```coffeescript [specscript]
   * leaveSwarm(options { force: boolean }) -> message Promise<string>
   * ```
   *
   * Removes the current node (server) from a Docker swarm.
   *
   * Arguments:
   *   * `options`
   *     * `force` - force remove the current node from the Docker swarm, even if the current node is the last manager node.
   *
   * Return:
   *   * `message` - the message from leaving the Docker swarm.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.leaveSwarm({ force: true })
   * ```
   */
  async leaveSwarm(options = {}) {
    const response = await this.http.post(`/swarm/leave?${
      querystring.stringify(pick(options, ['force']))
    }`)
    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

  /**
   * @name createService
   *
   * @docs
   * ```coffeescript [specscript]
   * createService(service string, options {
   *   image: string,
   *   replicas: 1|number,
   *   restart: 'no'|'on-failure[:<max-retries>]'|'any',
   *   restartDelay: 10e9|number,
   *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
   *   logDriverOptions: Object<string>,
   *   publish: Object<
   *     [hostPort string]: containerPort string # 8080
   *       |containerPortWithProtocol string # '<containerPort>[/<"tcp"|"udp"|"sctp">]'
   *   >,
   *   healthCmd: Array<string>,
   *   healthInterval: number, # number greater than 1e6
   *   healthTimeout: number, # number greater than 1e6
   *   healthRetries: number,
   *   healthStartPeriod: number, # number greater than or equal to 1e6
   *   memory: number,
   *   cpus: number,
   *   mounts: Array<{
   *     source: string,
   *     target: string,
   *     readonly: boolean,
   *     type: 'bind'|'cluster'|'image'|'npipe'|'tmpfs'|'volume',
   *   }>|Array<
   *     mount string, # '<source>:<target>[:<readonly true|false>]'
   *   >,
   *   updateParallelism: number,
   *   updateDelay: number,
   *   updateFailureAction: 'pause'|'continue'|'rollback',
   *   updateMonitor: number,
   *   updateMaxFailureRatio: number, # [0, 1]
   *   rollbackParallelism: 2|number,
   *   rollbackDelay: 1e9|number,
   *   rollbackFailureAction: 'pause'|'continue',
   *   rollbackMonitor: 15e9|number,
   *   rollbackMaxFailureRatio: 0.15|number,
   *   network: string,
   *   cmd: Array<string|number>,
   *   workdir: path string,
   *   env: Object<string>,
   *   labels: Object<string>,
   *
   *   # auth options
   *   username: string,
   *   password: string,
   *   email: string,
   *   serveraddress: string,
   *   identitytoken: string,
   * }) -> data Promise<{
   *   ID: string,
   *   Warnings: Array<string>,
   * }>
   * ```
   *
   * Creates a Docker service. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `service` - the Docker service name.
   *   * `options`
   *     * `image` - the Docker image that will be used by the Docker service.
   *     * `replicas` - the number of containers that the Docker service will run across all nodes of the Docker swarm. If `replicas` is set to 'global', the Docker service will run containers on each node of the Docker swarm.
   *     * `restart` - the restart policy for the Docker service.
   *     * `restartDelay` - the delay between restarts for the Docker service.
   *     * `logDriver` - the logging driver used for the Docker service.
   *     * `logDriverOptions` - driver-specific configuration options for the logging driver.
   *     * `publish` - object of mappings of host ports to Docker service ports with optional protocols.
   *     * `healthCmd` - a command that checks the health of the Docker service. The health check fails if the command errors. The command is run inside each Docker container of the Docker service.
   *     * `healthInterval` - time in nanoseconds to wait between healthchecks. Defaults to `10e9`.
   *     * `healthTimeout` - time in nanoseconds to wait before the healthcheck fails. Defaults to `20e9`.
   *     * `healthRetries` - number of times to retry the health check before the Docker container is considered unhealhty. Defaults to `5`.
   *     * `healthStartPeriod` - time in nanoseconds to wait when the Docker container starts up before running the first health check command.
   *     * `memory` - memory limit of each container of the Docker service in bytes.
   *     * `cpus` - CPU quota of each container of the Docker service in CPUs.
   *     * `mounts` - specification of each Docker service container's volumes or mounts.
   *     * `updateParallelism` - the maximum number of tasks to be updated in one iteration. `0` means unlimited parallelism. Defaults to `2`.
   *     * `updateDelay` - the delay in nanoseconds between task updates. Defaults to `1e9`.
   *     * `updateFailureAction` - the action to take if an updated task fails to run, or stops running during the task updates.
   *     * `updateMonitor` - the amount of time in nanoseconds to monitor each updated task for failures. Defaults to `15e9`.
   *     * `updateMaxFailureRatio` - the maximum ratio of tasks that may fail during an update before the failure action is invoked. Defaults to `0.15`.
   *     * `rollbackParallelism` - the maximum number of tasks to be rolled back in one iteration. `0` means unlimited parallelism. Defaults to `1`.
   *     * `rollbackDelay` - the delay in nanoseconds between rollback iterations. Defaults to `1e9`.
   *     * `rollbackFailureAction` - the action to take if a rolled back task fails to run, or stops running during the rollback. Defaults to `'pause'`.
   *     * `rollbackMonitor` - the amount of time in nanoseconds to monitor each rolled back task for failures. Defaults to `15e9`.
   *     * `rollbackMaxFailureRatio` - the maximum ratio of tasks that may fail during a rollback before the failure action is invoked. Defaults to `0.15`.
   *     * `network` - the network name or ID for attachment.
   *     * `cmd` - the command that to be run by the Docker service.
   *     * `workdir` - the working directory of the containers of the Docker service.
   *     * `env` - an object of the Docker service's environment variables. Maps environment variable names to environment variable values, e.g. `{ FOO: 'bar' }`.
   *     * `labels` - object of user-defined key/value metadata.
   *     * `username` - authentication credentials.
   *     * `password` - authentication credentials.
   *     * `email` - authentication credentials.
   *     * `serveraddress` - domain or IP of the registry server.
   *     * `identitytoken` - a token used to authenticate the user in place of a username and password.
   *
   * Return:
   *   * `data`
   *     * `ID` - the ID of the created Docker service.
   *     * `Warnings` - warnings encountered when creating the Docker service.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.createService('my-service', {
   *   image: 'node:15-alpine',
   *   replicas: 3,
   *   cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'Hello World.\')).listen(3001)'],
   *   workdir: '/home/node',
   *   env: { TEST: 'test' },
   *   restart: 'on-failure',
   *   publish: { 8081: 3001 },
   *   healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3001'],
    })
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async createService(service, options = {}) {
    const body = JSON.stringify({
      Name: service,
      Labels: options.labels ?? {},
      TaskTemplate: {
        ContainerSpec: {
          Image: options.image,
          ...options.cmd && { Command: options.cmd },
          ...options.env && {
            Env: Object.entries(options.env)
              .map(([key, value]) => `${key}=${value}`),
          },
          ...options.workdir && {
            Dir: options.workdir,
          },

          ...options.mounts && {
            Mounts: options.mounts.map(pipe([
              switchCase([
                isString,
                pipe([
                  split(':'),
                  all({ target: get(0), source: get(1), readonly: get(2) }),
                ]),
                identity,
              ]),
              all({
                Target: get('target'),
                Source: get('source'),
                Type: get('type', 'volume'),
                ReadOnly: get('readonly', false),
              }),
            ]))
          },

          ...options.healthCmd && {
            HealthCheck: {
              Test: ['CMD', ...options.healthCmd],
              ...all(options, {
                Interval: get('healthInterval', 10e9),
                Timeout: get('healthTimeout', 20e9),
                Retries: get('healthRetries', 5),
                StartPeriod: get('healthStartPeriod', 1e6),
              }),
            },
          },
        },

        ...options.restart && {
          RestartPolicy: all(options.restart.split(':'), {
            Delay: options.restartDelay ?? 10e9,
            Condition: get(0, 'on-failure'),
            MaxAttempts: pipe([get(1, 10), Number]),
          }),
        },

        Resources: {
          Reservations: {
            ...options.memory ? {
              MemoryBytes: Number(options.memory),
            } : {},
            ...options.cpus ? {
              NanoCPUs: Number(options.cpus * 1e9),
            } : {},

            ...options.gpus == 'all' ? {
              GenericResources: [{
                DiscreteResourceSpec: {
                  Kind: 'gpu',
                  Value: 1,
                },
              }],
            } : {},
          }, // bytes
        },

        ...options.logDriver && {
          LogDriver: {
            Name: options.logDriver,
            Options: { ...options.logDriverOptions },
          },
        },
      },

      Mode: options.replicas == 'global' ? {
        Global: {},
      } : {
        Replicated: { Replicas: options.replicas ?? 1 }
      },

      UpdateConfig: all({
        Parallelism: get('updateParallelism', 2),
        Delay: get('updateDelay', 1e9),
        FailureAction: get('updateFailureAction', 'pause'),
        Monitor: get('updateMonitor', 15e9),
        MaxFailureRatio: get('updateMaxFailureRatio', 0.15),
      })(options),

      RollbackConfig: all({
        Parallelism: get('rollbackParallelism', 1),
        Delay: get('rollbackDelay', 1e9),
        FailureAction: get('rollbackFailureAction', 'pause'),
        Monitor: get('rollbackMonitor', 15e9),
        MaxFailureRatio: get('rollbackMaxFailureRatio', 0.15),
      })(options),

      ...options.network && {
        Networks: [{
          Target: options.network,
          Aliases: [],
          DriverOpts: {},
        }],
      },

      ...options.publish && {
        EndpointSpec: {
          Ports: Object.entries(options.publish).map(pipe([
            map(String),
            all({
              Protocol: ([hostPort, containerPort]) => {
                const hostProtocol = hostPort.split('/')[1],
                  containerProtocol = containerPort.split('/')[1]
                return hostProtocol ?? containerProtocol ?? 'tcp'
              },
              TargetPort: pipe([get(1), split('/'), get(0), Number]),
              PublishedPort: pipe([get(0), split('/'), get(0), Number]),
              PublishMode: always('ingress'),
            }),
          ])),
        },
      },
    })

    const response = await this.http.post('/services/create', {
      body,
      headers: {
        'Content-Type': 'application/json',
        'X-Registry-Auth': pipe(options, [
          pick([
            'username',
            'password',
            'email',
            'serveraddress',
            'identitytoken',
          ]),
          JSON.stringify,
          Buffer.from,
          buffer => buffer.toString('base64'),
        ]),
      },
    })

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name updateService
   *
   * @docs
   * ```coffeescript [specscript]
   * updateService(service string, options {
   *   rollback: 'previous',
   *   force: boolean,
   *   image: string,
   *   replicas: 1|number,
   *   restart: 'no'|'on-failure[:<max-retries>]'|'any',
   *   restartDelay: 10e9|number,
   *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
   *   logDriverOptions: Object<string>,
   *   publish: Object<
   *     [hostPort string]: containerPort string # 8080
   *       |containerPortWithProtocol string # '<containerPort>[/<"tcp"|"udp"|"sctp">]'
   *   >,
   *   healthCmd: Array<string>,
   *   healthInterval: number, # number greater than 1e6
   *   healthTimeout: number, # number greater than 1e6
   *   healthRetries: number,
   *   healthStartPeriod: number, # number greater than or equal to 1e6
   *   memory: number,
   *   cpus: number,
   *   mounts: Array<{
   *     source: string,
   *     target: string,
   *     readonly: boolean,
   *     type: 'bind'|'cluster'|'image'|'npipe'|'tmpfs'|'volume',
   *   }>|Array<
   *     mount string, # '<source>:<target>[:<readonly true|false>]'
   *   >,
   *   cmd: Array<string|number>,
   *   workdir: path string,
   *   env: Object<string>,
   *   labels: Object<string>,
   *
   *   # auth options
   *   username: string,
   *   password: string,
   *   email: string,
   *   serveraddress: string,
   *   identitytoken: string
   * }) -> data Promise<{
   *   Warnings: Array<string>,
   * }>
   * ```
   *
   * Updates a Docker service. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `service` - the Docker service name.
   *   * `options`
   *     * `rollback` - causes a rollback to the previous Docker service version.
   *     * `force` - if `true`, an update of the Docker service will occur even if no relevant parameters have been changed. If `false`, no update will occur if no relevant parameters have been changed.
   *     * `image` - the Docker image that will be used by the Docker service.
   *     * `replicas` - the number of containers that the Docker service will run across all nodes of the Docker swarm. If `replicas` is set to 'global', the Docker service will run containers on each node of the Docker swarm.
   *     * `restart` - the restart policy for the Docker service.
   *     * `restartDelay` - the delay between restarts for the Docker service.
   *     * `logDriver` - the logging driver used for the Docker service.
   *     * `logDriverOptions` - driver-specific configuration options for the logging driver.
   *     * `publish` - object of mappings of host ports to Docker service ports with optional protocols.
   *     * `healthCmd` - a command that checks the health of the Docker service. The health check fails if the command errors. The command is run inside each Docker container of the Docker service.
   *     * `healthInterval` - time in nanoseconds to wait between healthchecks. Defaults to `10e9`.
   *     * `healthTimeout` - time in nanoseconds to wait before the healthcheck fails. Defaults to `20e9`.
   *     * `healthRetries` - number of times to retry the health check before the Docker container is considered unhealhty. Defaults to `5`.
   *     * `healthStartPeriod` - time in nanoseconds to wait when the Docker container starts up before running the first health check command.
   *     * `memory` - memory limit of each container of the Docker service in bytes.
   *     * `cpus` - CPU quota of each container of the Docker service in CPUs.
   *     * `mounts` - specification of each Docker service container's volumes or mounts.
   *     * `updateParallelism` - the maximum number of tasks to be updated in one iteration. `0` means unlimited parallelism. Defaults to `2`.
   *     * `cmd` - the command that to be run by the Docker service.
   *     * `workdir` - the working directory of the containers of the Docker service.
   *     * `env` - an object of the Docker service's environment variables. Maps environment variable names to environment variable values, e.g. `{ FOO: 'bar' }`.
   *     * `labels` - object of user-defined key/value metadata.
   *     * `username` - authentication credentials.
   *     * `password` - authentication credentials.
   *     * `email` - authentication credentials.
   *     * `serveraddress` - domain or IP of the registry server.
   *     * `identitytoken` - a token used to authenticate the user in place of a username and password.
   *
   * Return:
   *   * `data`
   *     * `Warnings` - warnings encountered when updating the Docker service.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.updateService('my-service', {
   *   image: 'node:16-alpine',
   *   memory: 512e6,
   *   cpus: 2,
   * })
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async updateService(service, options = {}) {
    const serviceData = await this.inspectService(service)

    const updateServiceSpec = createUpdateServiceSpec({
      serviceName: service,
      Spec: serviceData.Spec,
      ...options,
    })

    const response = await this.http.post(`/services/${service}/update?${
      querystring.stringify({
        version: serviceData.Version.Index,
        ...pick(options, ['rollback']),
      })
    }`, {

      body: JSON.stringify(updateServiceSpec),
      headers: {
        'Content-Type': 'application/json',
        'X-Registry-Auth': pipe(options, [
          pick([
            'username',
            'password',
            'email',
            'serveraddress',
            'identitytoken',
          ]),
          JSON.stringify,
          Buffer.from,
          buffer => buffer.toString('base64'),
        ]),
      },
    })

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name deleteService
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteService(serviceId string) -> message Promise<string>
   * ```
   *
   * Deletes a Docker service. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `serviceId` - the ID or name of the Docker service.
   *
   * Return:
   *   * `message` - the message from deleting the Docker service.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.deleteService('my-service')
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async deleteService(id) {
    const response = await this.http.delete(`/services/${id}`)
    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

  /**
   * @name listServices
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * listServices(options { filters: string }) -> data Promise<{
   *   ID: string,
   *   Version: DockerDocs.ObjectVersion,
   *   CreatedAt: string, # ISO 8601 date string
   *   UpdatedAt: string, # ISO 8601 date string
   *   Spec: DockerDocs.NodeSpec,
   *   Endpoint: Object<{
   *     Spec: DockerDocs.EndpointSpec,
   *     Ports: Array<DockerDocs.EndpointPortConfig>,
   *     VirtualIPs: Array<{
   *       NetworkID: string,
   *       Addr: string,
   *     }>,
   *   }>,
   *   UpdateStatus: {
   *     State: 'updating'|'paused'|'completed',
   *     StartedAt: string, # ISO 8601 date string
   *     CompletedAt: string, # ISO 8601 date string
   *     Message: string,
   *   },
   *   ServiceStatus: {
   *     RunningTasks: number,
   *     DesiredTasks: number,
   *     CompletedTasks: number,
   *   },
   *   JobStatus: {
   *     JobIteration: DockerDocs.ObjectVersion,
   *   },
   * }>
   * ```
   *
   * Returns a list of the Docker services running in a Docker swarm. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `options`
   *     * `filters` - filters for the returned list of Docker services.
   *
   * Return:
   *   * `data`
   *     * `ID` - the ID of the created Docker service.
   *     * `Version` - the version of the Docker service.
   *     * `CreatedAt` - the date and time at which the Docker service was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `UpdatedAt` - the date and time at which the Docker service was updated as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Spec` - the Docker service configuration.
   *     * `Endpoint` - configuration to access and load balance the Docker service.
   *     * `UpdateStatus` - the status of the update of the Docker service.
   *     * `ServiceStatus` - the status of the Docker service's tasks.
   *     * `JobStatus` - the status of the Docker service when it is one of ReplicatedJob or GlobalJob modes.
   *
   * Available filters:
   *   * `id=<serviceId>`
   *   * `label=<serviceLabel>`
   *   * `mode=<"replicated"|"global">`
   *   * `name=<serviceName>`
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.listServices()
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async listServices(options = {}) {
    const response = await this.http.get(`/services?${
      querystring.stringify(pick(options, ['filters']))
    }`)
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name inspectService
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * inspectService(serviceId string) -> data Promise<{
   *   ID: string,
   *   Version: DockerDocs.ObjectVersion,
   *   CreatedAt: string, # ISO 8601 date string
   *   UpdatedAt: string, # ISO 8601 date string
   *   Spec: DockerDocs.NodeSpec,
   *   Endpoint: Object<{
   *     Spec: DockerDocs.EndpointSpec,
   *     Ports: Array<DockerDocs.EndpointPortConfig>,
   *     VirtualIPs: Array<{
   *       NetworkID: string,
   *       Addr: string,
   *     }>,
   *   }>,
   *   UpdateStatus: {
   *     State: 'updating'|'paused'|'completed',
   *     StartedAt: string, # ISO 8601 date string
   *     CompletedAt: string, # ISO 8601 date string
   *     Message: string,
   *   },
   *   ServiceStatus: {
   *     RunningTasks: number,
   *     DesiredTasks: number,
   *     CompletedTasks: number,
   *   },
   *   JobStatus: {
   *     JobIteration: DockerDocs.ObjectVersion,
   *   },
   * }>
   * ```
   *
   * Inspects a Docker service running in a Docker swarm. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `serviceId` - the ID or name of the Docker service.
   *
   * Return:
   *   * `data`
   *     * `ID` - the ID of the created Docker service.
   *     * `Version` - the version of the Docker service.
   *     * `CreatedAt` - the date and time at which the Docker service was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `UpdatedAt` - the date and time at which the Docker service was updated as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Spec` - the Docker service configuration.
   *     * `Endpoint` - configuration to access and load balance the Docker service.
   *     * `UpdateStatus` - the status of the update of the Docker service.
   *     * `ServiceStatus` - the status of the Docker service's tasks.
   *     * `JobStatus` - the status of the Docker service when it is one of ReplicatedJob or GlobalJob modes.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.inspectService('my-service')
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async inspectService(serviceId) {
    const response = await this.http.get(`/services/${serviceId}`)
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name getServiceLogs
   *
   * @docs
   * ```coffeescript [specscript]
   * module stream 'https://nodejs.org/api/stream.html'
   *
   * getServiceLogs(serviceId string, options {
   *   stdout: boolean,
   *   stderr: boolean,
   *   follow: boolean,
   *   since: number,
   *   timestamps: boolean,
   *   tail: number,
   * }) -> dataStream Promise<stream.Readable>
   * ```
   *
   * Get logs for a Docker service. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `serviceId` - the ID or name of the Docker service.
   *   * `options`
   *     * `stdout` - return logs from the stdout of all of the containers of the Docker service.
   *     * `stderr` - return logs from the stderr of all of the containers of the Docker service.
   *     * `follow` - keep the connection alive and return new logs in realtime after returning the logs from the Docker service.
   *     * `since` - a unix timestamp after which to return logs for the Docker service.
   *     * `timestamps` - adds a timestamp to every log line of the returned logs.
   *     * `tail` - the maximum number of log lines to return from the end of all logs for the Docker service.
   *
   * Return:
   *   * `dataStream` - a readable stream of the Docker service logs.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const logStream = await docker.getServiceLogs('my-service', {
   *   tail: 1000,
   *   follow: true,
   * })
   *
   * logStream.pipe(process.stdout)
   * logStream.on('end', () => {
   *   console.log('getServiceLogs success.')
   * })
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async getServiceLogs(serviceId, options = {}) {
    const response = await this.http.get(`/services/${serviceId}/logs?${
      querystring.stringify(pick(options, [
        'stdout', 'stderr', 'follow',
        'since', 'timestamps', 'tail',
      ]))
    }`)

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name listTasks
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * listTasks(options {
   *   desiredState: 'running'|'shutdown'|'accepted'
   *   service: string,
   * }) -> data Promise<[
   *   ID: string,
   *   Version: DockerDocs.ObjectVersion,
   *   CreatedAt: string, # ISO 8601 date string
   *   UpdatedAt: string, # ISO 8601 date string
   *   Name: string,
   *   Labels: Object<string>,
   *   Spec: DockerDocs.TaskSpec,
   *   ServiceID: string,
   *   Slot: number,
   *   NodeID: string,
   *   AssignedGenericResources: Array<DockerDocs.GenericResources>,
   *   Status: DockerDocs.TaskStatus,
   *   DesiredState: 'new'|'allocated'|'pending'|'assigned'|'accepted'
   *     |'preparing'|'ready'|'starting'|'running'|'complete'|'shutdown'
   *     |'failed'|'rejected'|'remove'|'orphaned',
   *   JobIteration: DockerDocs.ObjectVersion,
   * ]>
   * ```
   *
   * Returns a list of tasks running on a Docker swarm. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `options`
   *     * `desiredState` - returns a list of tasks with `DesiredState` filtered by this option.
   *     * `service` - the name or ID of the Docker service.
   *
   * Return:
   *   * `data`
   *     * `ID` - the ID of the task.
   *     * `Version` - the version number of the task.
   *     * `CreatedAt` - the date and time at which the task was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `UpdatedAt` - the date and time at which the task was updated as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT).
   *     * `Name` - the name of the task.
   *     * `Labels` - object of user-defined key/value metadata.
   *     * `Spec` - the task configuration.
   *     * `ServiceID` - the ID of the Docker service that the task belongs to.
   *     * `Slot` - used by the orchestrator for scheduling purposes.
   *     * `NodeID` - the ID of the node that the task is on.
   *     * `AssignedGenericResources` - user-defined resources.
   *     * `Status` - the status of the task.
   *     * `DesiredState` - the desired status of the task.
   *     * `JobIteration` - the version number of the task.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const tasksData = await docker.listTasks()
   * const runningTasksData = await docker.listTasks({ desiredState: 'running' })
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async listTasks(options = {}) {
    const filters = pipe({
      'desired-state': options.desiredState,
      service: options.service,
    }, [
      filter(value => value != null),
      map(value => Array.isArray(value) ? value : [value]),
      JSON.stringify,
    ])

    const qs = querystring.stringify({ filters })
    const response = await this.http.get(`/tasks?${qs}`)
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name listNodes
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * listNodes() -> data Promise<[
   *   ID: string,
   *   Version: DockerDocs.ObjectVersion,
   *   CreatedAt: string, # ISO 8601 date string
   *   UpdatedAt: string, # ISO 8601 date string
   *   Spec: DockerDocs.NodeSpec,
   *   Description: DockerDocs.NodeDescription,
   *   Status: DockerDocs.NodeStatus,
   *   ManagerStatus: DockerDocs.ManagerStatus,
   * ]>
   * ```
   *
   * Lists the nodes of a Docker Swarm. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `ID` - the node ID.
   *     * `Version` - the version number of the node.
   *     * `CreatedAt` - the date and time at which the node was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT).
   *     * `UpdatedAt` - the date and time at which the node was updated as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT).
   *     * `Spec` - the node configuration.
   *     * `Description` - the properties of the node reported by the agent.
   *     * `Status` - the current status of the node.
   *     * `ManagerStatus` - the current status of node's manager component, if the node is a manager.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.listNodes()
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async listNodes() {
    const response = await this.http.get('/nodes')
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name deleteNode
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteNode(nodeId string) -> message Promise<string>
   * ```
   *
   * Deletes a node from a Docker swarm. The current node (server) must be a manager node in a Docker swarm.
   *
   * Arguments:
   *   * `nodeId` - the ID of the node to delete.
   *
   * Return:
   *   * `message` - the message from deleting the node.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.deleteNode('node-id')
   * ```
   *
   * References:
   *   * [Docker Swarm](https://docs.docker.com/engine/swarm/)
   */
  async deleteNode(id) {
    const response = await this.http.delete(`/nodes/${id}`)
    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

  /**
   * @name pruneImages
   *
   * @docs
   * ```coffeescript [specscript]
   * pruneImages() -> data Promise<{
   *   ImagesDeleted: Array<{ Untagged: string }|{ Deleted: string }>,
   *   SpaceReclaimed: number, # bytes
   * }>
   * ```
   *
   * Prunes Docker images. Deletes unused Docker images from the server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `ImagesDeleted` - Docker images that were deleted.
   *     * `SpaceReclaimed` - disk space reclaimed in bytes.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.pruneImages()
   * ```
   */
  async pruneImages() {
    const response = await this.http.post('/images/prune')
    const data = await handleDockerHTTPResponse(response)
    data.ImagesDeleted ??= []
    return data
  }

  /**
   * @name pruneContainers
   *
   * @docs
   * ```coffeescript [specscript]
   * pruneContainers() -> data Promise<{
   *   ContainersDeleted: Array<string>,
   *   SpaceReclaimed: integer, # bytes
   * }>
   * ```
   *
   * Prunes Docker containers. Deletes stopped Docker containers from the server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `ContainersDeleted` - Docker container IDs that were deleted.
   *     * `SpaceReclaimed` - disk space reclaimed in bytes.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.pruneContainers()
   * ```
   */
  async pruneContainers() {
    const response = await this.http.post('/containers/prune')
    const data = await handleDockerHTTPResponse(response)
    data.ContainersDeleted ??= []
    return data
  }

  /**
   * @name pruneVolumes
   *
   * @docs
   * ```coffeescript [specscript]
   * pruneVolumes() -> data Promise<{
   *   VolumesDeleted: Array<string>, # volume IDs
   *   SpaceReclaimed: integer, # bytes
   * }>
   * ```
   *
   * Prunes Docker volumes. Deletes unused volumes from the server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `VolumesDeleted` - IDs of volumes that were deleted.
   *     * `SpaceReclaimed` - disk space reclaimed in bytes.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.pruneVolumes()
   * ```
   */
  async pruneVolumes() {
    const response = await this.http.post('/volumes/prune')
    const data = await handleDockerHTTPResponse(response)
    data.VolumesDeleted ??= []
    return data
  }

  /**
   * @name pruneNetworks
   *
   * @docs
   * ```coffeescript [specscript]
   * pruneNetworks() -> data Promise<{
   *   NetworksDeleted: Array<string>, # network IDs
   * }>
   * ```
   *
   * Prunes Docker networks. Removes unused networks from the server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `NetworksDeleted` - IDs of networks that were deleted.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.pruneNetworks()
   * ```
   */
  async pruneNetworks() {
    const response = await this.http.post('/networks/prune')
    const data = await handleDockerHTTPResponse(response)
    data.NetworksDeleted ??= []
    return data
  }

  /**
   * @name createNetwork
   *
   * @docs
   * ```coffeescript [specscript]
   * createNetwork(options {
   *   name: string,
   *   driver: 'bridge'|'host'|'overlay'|'ipvlan'|'macvlan',
   *   ingress: boolean,
   *   subnet: string,
   *   gateway: string,
   * }) -> data Promise<{
   *   Id: string,
   *   Warning: string,
   * }>
   * ```
   *
   * Creates a Docker network.
   *
   * Arguments:
   *   * `options`
   *     * `name` - the name of the network to create.
   *     * `driver` - the name of the network driver plugin to use.
   *     * `ingress` - if `true`, creates an ingress network. The ingress network is the network that provides the routing-mesh in swarm mode. If `false`, does not create an ingress network.
   *     * `subnet` - the subnet of the network.
   *     * `gateway` - the gateway of the network.
   *
   * Return:
   *   * `data`
   *     * `Id` - the ID of the created network.
   *     * `Warning` - warnings encountered when creating the network.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.createNetwork({
   *   name: 'my-network',
   *   driver: 'overlay',
   * })
   * ```
   */
  async createNetwork(options) {
    const response = await this.http.post('/networks/create', {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filterExists({
        Name: options.name,
        Driver: options.driver,
        Ingress: options.ingress,
        CheckDuplicate: true,
        ...options.subnet == null && options.gateway == null ? {} : {
          IPAM: {
            Driver: 'default',
            Config: [filterExists({
              Subnet: options.subnet,
              Gateway: options.gateway,
            })],
            Options: {},
          },
        },
      })),
    })

    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name inspectNetwork
   *
   * @docs
   * ```coffeescript [specscript]
   * module DockerDocs 'https://docs.docker.com/reference/api/engine/version/v1.52/'
   *
   * inspectNetwork(networkId string) -> data Promise<{
   *   Containers: Object<DockerDocs.EndpointResource>,
   *   Services: Object<any>,
   *   Status: DockerDocs.NetworkStatus,
   *   Name: string,
   *   Id: string,
   *   Created: string, # ISO 8601 date string
   *   Scope: 'swarm'|'local',
   *   Driver: string,
   *   EnableIPv4: boolean,
   *   EnableIPv6: boolean,
   *   IPAM: DockerDocs.IPAM,
   *   Internal: boolean,
   *   Attachable: boolean,
   *   Ingress: boolean,
   *   ConfigFrom: DockerDocs.ConfigReference,
   *   ConfigOnly: boolean,
   *   Options: Object<string>,
   *   Labels: Object<string>,
   *   Peers: Array<DockerDocs.PeerInfo>,
   * }>
   * ```
   *
   * Inspects a Docker network.
   *
   * Arguments:
   *   * `networkId` - the ID of the network to inspect.
   *
   * Return:
   *   * `data`
   *     * `Containers` - the endpoints attached to the network.
   *     * `Services` - the services using the network.
   *     * `Status` - runtime information about the network.
   *     * `Name` - the name of the network.
   *     * `Id` - the network ID.
   *     * `Created` - the date and time at which the network was created as seconds since EPOCH (January 1, 1970 at midnight UTC/GMT). 
   *     * `Scope` - the level at which the network exists.
   *     * `Driver` - the name of the driver used to create the network.
   *     * `EnableIPv4` - whether the network was created with IPv4 enabled.
   *     * `EnableIPv6` - whether the network was created with IPv6 enabled.
   *     * `IPAM` - the network's IPAM configuration.
   *     * `Internal` - whether the network was created to only allow internal networking connectivity.
   *     * `Attachable` - whether the network is manually attachable by regular containers from worker nodes in a Docker swarm.
   *     * `Ingress` - whether the network is providing the routing-mesh for a Docker swarm.
   *     * `ConfigFrom` - the config-only network source that provides the configuration for the network.
   *     * `ConfigOnly` - whether the network is a config-only network. Config-only networks are placeholder networks for network configurations to be used by other networks. Config-only networks cannot be used directly to run containers or services.
   *     * `Options` - network-specific options used when creating the network.
   *     * `Labels` - object of user-defined key/value metadata.
   *     * `Peers` - list of peer nodes for the network. `Peers` is only present if the network is an overlay network.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * const data = await docker.inspectNetwork('my-network')
   * ```
   */
  async inspectNetwork(id) {
    const response = await this.http.get(`/networks/${id}`)
    const data = await handleDockerHTTPResponse(response)
    return data
  }

  /**
   * @name deleteNetwork
   *
   * @docs
   * ```coffeescript [specscript]
   * deleteNetwork(networkId string) -> message Promise<string>
   * ```
   *
   * Deletes a Docker network.
   *
   * Arguments:
   *   * `networkId` - the ID of the network to delete.
   *
   * Return:
   *   * `message` - the message from deleting the network.
   *
   * ```javascript
   * const docker = new Docker()
   *
   * await docker.deleteNetwork('my-network')
   * ```
   */
  async deleteNetwork(id) {
    const response = await this.http.delete(`/networks/${id}`)
    const message = await handleDockerHTTPResponse(response, { text: true })
    return message
  }

}

// Docker.RawStreamHeader = function (buffer) {}

module.exports = Docker
