# Presidium
![presidium](https://rubico.land/assets/presidium-logo-3-w200.jpg)

The Presidium library.

Source code: [GitHub](https://github.com/richytong/presidium) |
License: [CFOSS](https://cloutsworld.com/en-us/legal/license/cfoss)

![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

### Presidium WebSocket

Source code: [GitHub](https://github.com/richytong/presidium-websocket) |
License: [CFOSS](https://cloutsworld.com/en-us/legal/license/cfoss)

![Node.js CI](https://github.com/richytong/presidium-websocket/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-websocket/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium-websocket)
[![npm version](https://img.shields.io/npm/v/presidium-websocket.svg?style=flat)](https://www.npmjs.com/package/presidium-websocket)

### Presidium DB

Source code: [GitHub](https://github.com/richytong/presidium-db) |
License: [CFOSS](https://cloutsworld.com/en-us/legal/license/cfoss)

![Node.js CI](https://github.com/richytong/presidium-db/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-db/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium-db)
[![npm version](https://img.shields.io/npm/v/presidium-db.svg?style=flat)](https://www.npmjs.com/package/presidium-db)

### Presidium DB Client and Server

Source code: [GitHub](https://github.com/richytong/presidium-db-client-server) |
License: [CFOSS](https://cloutsworld.com/en-us/legal/license/cfoss)

![Node.js CI](https://github.com/richytong/presidium-db-client-server/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-db-client-server/graph/badge.svg?token=07P6G8GIOQ)](https://codecov.io/gh/richytong/presidium-db-client-server)
[![npm version](https://img.shields.io/npm/v/presidium-db-client-server.svg?style=flat)](https://www.npmjs.com/package/presidium-db-client-server)

### Presidium File Client and Server

Source code: [GitHub](https://github.com/richytong/presidium-file-client-server) |
License: [CFOSS](https://cloutsworld.com/en-us/legal/license/cfoss)

![Node.js CI](https://github.com/richytong/presidium-file-client-server/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-file-client-server/graph/badge.svg?token=07P6G8GIOQ)](https://codecov.io/gh/richytong/presidium-file-client-server)
[![npm version](https://img.shields.io/npm/v/presidium-file-client-server.svg?style=flat)](https://www.npmjs.com/package/presidium-file-client-server)

## Installation
with [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):
```bash
npm i presidium
```

require Presidium in [CommonJS](https://nodejs.org/docs/latest/api/modules.html#modules-commonjs-modules):
```javascript
// import Presidium globally
require("presidium/global")

// import Presidium
const presidium = require("presidium")

// import Presidium clients
const DynamoDBTable = require("presidium/DynamoDBTable")
const S3Bucket = require("presidium/S3Bucket")
const WebSocket = require("presidium/WebSocket")
const Readable = require("presidium/Readable")
```

## [Handle HTTP](https://presidium.services/docs/HTTP)
```javascript
const HTTP = require("presidium/HTTP")

const server = HTTP.Server((request, response) => {
  response.writeHead(200, { "Content-Type": "application/json" })
  response.write(JSON.stringify({ greeting: "Hello World" }))
  response.end()
})

server.listen(3000)

const http = new HTTP("http://localhost:3000/")

http.get("/")
  .then(response => response.json())
  .then(console.log) // { greeting: "Hello World" }
```

## [Send messages with WebSocket](https://presidium.services/docs/WebSocket)
```javascript
const WebSocket = require("presidium/WebSocket")

const server = new WebSocket.Server(websocket => {
  websocket.on("message", message => {
    console.log("Message from client:", message)
    websocket.send("Hello Client!")
  })
  websocket.on("close", () => {
    console.log("websocket closed")
  })
})
server.listen(1337)

const websocket = new WebSocket("ws://localhost:1337/")
websocket.on("open", () => {
  websocket.send("Hello Server!")
})
websocket.on("message", message => {
  console.log("Message from server:", message)
})
```

## [Validate data](https://presidium.services/docs/Validator)
```javascript
const Validator = require("presidium/Validator")

const {
  Object, Array, Number, String, Email, Boolean, OneOf, Optional,
} = Validator

const validator = Object({
  Name: String,
  Email: Email,
  Password: String,
  Preferences: Object({
    Gender: OneOf("Male", "Female"),
  }),
  Gender: OneOf("Male", "Female"),
  IsReturning: Boolean,
  Time: Optional(Number),
  Media: Array(Object({
    MediaUrl: String,
    Description: String,
  })),
})

const data = {
  Name: "Example Name",
  Email: "email@domain.com",
  Password: "************",
  Preferences: {
    Gender: "Male",
  },
  IsReturning: false,
  Media: [{
    MediaUrl: "https://cdn.my-website.com/assets/1.mp4",
    Description: "Example description.",
  }],
}

validator(data)
```

## [Build and push Docker images](https://presidium.services/docs/Docker)
```javascript
const Docker = require("presidium/Docker")
const NpmToken = require("presidium/NpmToken")
const fs = require("fs")

const myImage = "my-app:1.0.0"

const npmrc = fs.createWriteStream(".npmrc")
npmrc.write(`//registry.npmjs.org/:_authToken=${await NpmToken()}`)
npmrc.end()

const buildStream = await docker.buildImage(__dirname, {
  image: myImage,
  ignore: [".github", "node_modules"],
  archive: {
    Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN npm i \
  && rm .npmrc \
  && rm Dockerfile
EXPOSE 8080
CMD ["npm", "start"]
    `,
  },
})

buildStream.pipe(process.stdout)

buildStream.on("end", () => {
  const pushStream = await docker.pushImage({
    image: myImage,
    repository: "my-registry.io",
  })
  pushStream.pipe(process.stdout)
})

```

## [Run Docker containers](https://presidium.services/docs/Docker)
```javascript
const Docker = require("presidium/Docker")

const docker = new Docker()

const runStream = await docker.runContainer({
  image: "node:15-alpine",
  env: { FOO: "Example" },
  cmd: ["node", "-e", "console.log(process.env.FOO)"],
  rm: true,
})

runStream.pipe(process.stdout) // Example
```

## [Deploy Docker Swarm services](https://presidium.services/docs/Docker)
```javascript
const Docker = require("presidium/Docker")

const docker = new Docker()

// initialize docker swarm
await docker.initSwarm("eth0:2377")

await docker.createService({
  name: "my-service",
  image: "nginx:1.19",
  publish: { 80: 80 },
  healthCheck: ["curl", "[::1]"],
  replicas: 5,
})
// new nginx service is deploying to the docker swarm
```

## [Automate tests with Google Chrome for Testing](https://presidium.services/docs/GoogleChromeDevTools)
```javascript
const GoogleChromeForTesting = require("presidium/GoogleChromeForTesting")
const GoogleChromeDevTools = require("presidium/GoogleChromeDevTools")

const googleChromeForTesting = new GoogleChromeForTesting()
await googleChromeForTesting.init() // downloads Google Chrome for Testing

const googleChromeDevTools = new GoogleChromeDevTools(googleChromeForTesting)
await googleChromeDevTools.init() // connects to the DevTools server

// get targets
const targetsData = await googleChromeDevTools.Target.getTargets()
const pageTarget = targetsData.result.targetInfos.find(info => info.type == "page")

// attach to target
const attachToTargetData = await googleChromeDevTools.Target.attachToTarget({
  targetId: this.pageTarget.targetId,
  flatten: true,
})
const sessionId = attachToTargetData.result.sessionId

// navigate to the home page
const data = await googleChromeDevTools.Page.navigate({
  sessionId: this.sessionId,
  url: `http://localhost:3000/`,
})
```

## [Store data on disk in a hash table](https://presidium.services/docs/DiskHashTable)
```javascript
const DiskHashTable = require("presidium/DiskHashTable")

const ht = new DiskHashTable({
  storageFilepath: "/path/to/ht-storage-file",
  headerFilepath: "/path/to/ht-header-file",
  initialLength: 1024,
})
await ht.init()

await ht.set("my-key", "my-value")

const myValue = await ht.get("my-key")
console.log(myValue) // my-value

await ht.delete("my-key")
```

## [Store data on disk in a sorted hash table](https://presidium.services/docs/DiskSortedHashTable)
```javascript
const DiskSortedHashTable = require("presidium/DiskSortedHashTable")

const sortedHt = new DiskSortedHashTable({
  storageFilepath: "/path/to/sortedHt-storage-file",
  headerFilepath: "/path/to/sortedHt-header-file",
  initialLength: 1024,
})
await sortedHt.init()

await sortedHt.set("first-key", "first-value", 1)
await sortedHt.set("second-key", "second-value", 2)
await sortedHt.set("third-key", "third-value", 3)

for await (const value of sortedHt.forwardIterator()) {
  console.log(value) // first-value
                     // second-value
                     // third-value
}

for await (const value of sortedHt.reverseIterator()) {
  console.log(value) // third-value
                     // second-value
                     // first-value
}

for await (const value of sortedHt.forwardIterator({ startingSortValue: 2, endingSortValue: 3 })) {
  console.log(value) // second-value
                     // third-value
}

for await (const value of sortedHt.reverseIterator({ startingSortValue: 2, endingSortValue: 1 })) {
  console.log(value) // second-value
                     // first-value
}
```

## [Host your own distributed database](https://presidium.services/docs/DatabaseServer)
```javascript
const DatabaseServer = require("presidium/DatabaseServer")

const server = new DatabaseServer({
  databasePath: `${__dirname}/database`,
})
await server.init()

await server.registerDiskHashTable("Session", {
  storagePath: `${this.databasePath}/Session/storage`,
  headerPath: `${this.databasePath}/Session/header`,
  initialLength: 536870912,
  itemSize: 512,
})

await server.registerDiskSortedHashTable("Post", {
  storagePath: `${this.databasePath}/Post/storage`,
  headerPath: `${this.databasePath}/Post/header`,
  initialLength: 1048576,
  itemSize: 8192,
  sortValueType: "number",
  degree: 2,
})

server.listen(5000, () => {
  console.log("Database server listening on port 5000")
})
```

## [Call a database table from anywhere](https://presidium.services/docs/DiskHashTableClient)
```javascript
const DiskHashTableClient = require("presidium/DiskHashTableClient")

const sessionHt = new DiskHashTableClient({
  serverUrl: "http://localhost:5000",
  tableName: "Session",
})

const accessToken = "token"
const session = { accessToken }

await sessionHt.set(accessToken, JSON.stringify(session))

const sessionJson = await sessionHt.get(accessToken)

await sessionHt.delete(accessToken)
```

## [Query a database table from anywhere](https://presidium.services/docs/DiskSortedHashTableClient)
```javascript
const DiskSortedHashTableClient = require("presidium-db-client-server/DiskSortedHashTableClient")

const postHt = new DiskSortedHashTableClient({
  serverUrl: "http://localhost:5000",
  tableName: "Post",
  sortValueType: "number",
})

const post1 = {
  id: "post-1",
  images: ["/assets/post-1/image-1.jpg"],
  content: "First post",
  time: Date.now(),
}

const post2 = {
  id: "post-2",
  images: ["/assets/post-2/image-2.jpg"],
  content: "Second post",
  time: Date.now(),
}

const post3 = {
  id: "post-3",
  images: ["/assets/post-3/image-3.jpg"],
  content: "Third post",
  time: Date.now(),
}

await postHt.set(post1.id, JSON.stringify(post1), post1.time)
await postHt.set(post2.id, JSON.stringify(post2), post2.time)
await postHt.set(post3.id, JSON.stringify(post3), post3.time)

const myPosts = []
for await (const postJson of await postHt.reverseIterator()) {
  myPosts.push(JSON.parse(postJson))
}
```

## [Load balance your distributed database](https://presidium.services/docs/DatabaseLoadBalancer)
```javascript
const DatabaseLoadBalancer = require("presidium/DatabaseLoadBalancer")

const loadBalancer = new DatabaseLoadBalancer({
  serverIps: ["10.0.0.1:8080", "10.0.0.2:8080"],
})

loadBalancer.listen(6333, () => {
  console.log("Database load balancer listening on port 6333")
})
```

## [Host your own file service](https://presidium.services/docs/FileServer)
```javascript
const FileServer = require("presidium/FileServer")

const fileServer = new FileServer({
  dir: `${__dirname}/files`,
  databasePath: `${__dirname}/database`,
})
await fileServer.init()

fileServer.listen(9000, () => {
  console.log("File server listening on port 9000")
})
```

## [Call your file service](https://presidium.services/docs/FileClient)
```javascript
const FileClient = require("presidium/FileClient")

const fileClient = new FileClient({
  serverUrl: "http://localhost:9000",
})

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Page</title>
</head>
<body>
    <h1>My Page</h1>
</body>
</html>
`

await fileClient.write("/public/my-page", html, {
  ContentType: "text/html",
})

const data = await fileClient.read("/public/my-page")
data.FileStream.pipe(process.stdout)
```

## [Load balance and distribute content from your file service](https://presidium.services/docs/FileLoadBalancer)
```javascript
const FileLoadBalancer = require("presidium/FileLoadBalancer")

const loadBalancer = new FileLoadBalancer({
  serverIps: ["10.0.0.1:8080", "10.0.0.2:8080"],
})

loadBalancer.listen(9000, () => {
  console.log("Database load balancer listening on port 9000")
})
```

## License
Presidium is distributed under the [CFOSS License](https://cloutsworld.com/en-us/legal/license/cfoss).

## Support
 * minimum Node.js version: 16
