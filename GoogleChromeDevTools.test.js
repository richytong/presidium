const Test = require('thunk-test')
const assert = require('assert')
const http = require('http')
const { exec } = require('child_process')
const sleep = require('./internal/sleep')
const GoogleChromeForTesting = require('./GoogleChromeForTesting')
const GoogleChromeDevTools = require('./GoogleChromeDevTools')

const PORT = 7357

const test = new Test('GoogleChromeDevTools', async function integration() {
  await exec('ps aux | grep "Google Chrome for Testing" | awk \'{print $2}\' | xargs kill', {
    stdio: 'inherit',
  })

  {
    const googleChromeDevTools = new GoogleChromeDevTools()
    assert.equal(googleChromeDevTools.chromeVersion, 'stable')
    assert.equal(googleChromeDevTools.chromeDir, 'google-chrome-for-testing')
    assert.equal(googleChromeDevTools.remoteDebuggingPort, 9222)
    assert.equal(googleChromeDevTools.headless, false)
    assert.equal(googleChromeDevTools.userDataDir, 'tmp/chrome')
  }

  {
    const googleChromeDevTools = new GoogleChromeDevTools({
      chromeVersion: 'stable',
      chromeDir: `${__dirname}/google-chrome-for-testing`,
      remoteDebuggingPort: 9222,
      headless: true,
      userDataDir: `${__dirname}/tmp/chrome`,
      useMockKeychain: true,
    })
    assert.equal(googleChromeDevTools.chromeVersion, 'stable')
    assert.equal(googleChromeDevTools.chromeDir, `${__dirname}/google-chrome-for-testing`)
    assert.equal(googleChromeDevTools.remoteDebuggingPort, 9222)
    assert.equal(googleChromeDevTools.headless, true)
    assert.equal(googleChromeDevTools.userDataDir, `${__dirname}/tmp/chrome`)
    assert.equal(googleChromeDevTools.useMockKeychain, true)
  }

  { // downloads Google Chrome for Testing if not provided
    const googleChromeDevTools = new GoogleChromeDevTools({ headless: true })
    await googleChromeDevTools.init()

    let closeResolve
    const closePromise = new Promise(_resolve => {
      closeResolve = _resolve
    })
    googleChromeDevTools.on('close', () => {
      closeResolve()
    })
    googleChromeDevTools.close()
    await closePromise

    console.log(googleChromeDevTools)
    googleChromeDevTools.googleChromeForTesting.close()
  }

  const googleChromeForTesting = new GoogleChromeForTesting({ headless: true })
  await googleChromeForTesting.init()

  const googleChromeDevTools = new GoogleChromeDevTools(googleChromeForTesting)
  await googleChromeDevTools.init()
  await googleChromeDevTools.init()

  assert.equal(googleChromeDevTools.chromeVersion, 'stable')
  assert.equal(googleChromeDevTools.chromeDir, 'google-chrome-for-testing')
  assert.equal(googleChromeDevTools.remoteDebuggingPort, 9222)
  assert.equal(googleChromeDevTools.headless, true)
  assert.equal(googleChromeDevTools.userDataDir, 'tmp/chrome')
  assert.equal(googleChromeDevTools.googleChromeForTesting.chromeVersion, 'stable')
  assert.equal(googleChromeDevTools.googleChromeForTesting.chromeDir, 'google-chrome-for-testing')
  assert.equal(googleChromeDevTools.googleChromeForTesting.remoteDebuggingPort, 9222)
  assert.equal(googleChromeDevTools.googleChromeForTesting.headless, true)
  assert.equal(googleChromeDevTools.googleChromeForTesting.userDataDir, 'tmp/chrome')

  {
    const data = await googleChromeDevTools.Target.getTargets()
    assert(data.targetInfos.length > 0)
    this.pageTarget = data.targetInfos.find(info => info.type == 'page')
  }

  {
    const data = await googleChromeDevTools.Target.attachToTarget({
      targetId: this.pageTarget.targetId,
      flatten: true,
    })
    assert.equal(typeof data.sessionId, 'string')
    this.sessionId = data.sessionId
  }

  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/health')) {
      response.writeHead(200, {
        'Content-Type': 'text/plain',
      })
      response.end('OK')
    } else if (request.method == 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      })
      response.end()
    } else {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
      })
      response.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>

<script>
function addParagraph() {
  const element = document.createElement('p')
  element.textContent = document.getElementsByTagName('input')[0].value
  document.body.appendChild(element)
}
</script>

<body>
  <h1>Test</h1>
  <Input></Input>
  <Button onclick="addParagraph()">Submit</Button>
</body>


</html>
      `)
    }
  })

  server.listen(PORT, () => {
    console.log('HTTP server listening on port', PORT)
  })

  await googleChromeDevTools.Page.navigate({
    url: `http://localhost:${PORT}`,
    sessionId: this.sessionId,
  })


  function* flattenNodes(nodeTree) {
    const nodes = []
    for (const node of nodeTree) {
      if (node.children) {
        const { children, ...parentNode } = node
        yield parentNode
        yield* flattenNodes(children)
      } else {
        yield node
      }
    }
  }

  googleChromeDevTools.setSessionId(this.sessionId)
  assert.equal(typeof googleChromeDevTools.sessionId, 'string')
  assert.equal(typeof googleChromeDevTools.Page.sessionId, 'string')
  assert.equal(typeof googleChromeDevTools.DOM.sessionId, 'string')
  assert.equal(typeof googleChromeDevTools.Input.sessionId, 'string')
  assert.equal(typeof googleChromeDevTools.Storage.sessionId, 'string')
  assert.equal(typeof googleChromeDevTools.Runtime.sessionId, 'string')

  await googleChromeDevTools.DOM.enable()

  {
    const data = await googleChromeDevTools.DOM.getDocument({ depth: 10 })
    assert.equal(data.root.nodeName, '#document')
    const nodes = [...flattenNodes([data.root])]
    const titleNodeIndex = nodes.findIndex(node => node.nodeName == 'TITLE')
    assert.equal(nodes[titleNodeIndex + 1].nodeName, '#text')
    assert.equal(nodes[titleNodeIndex + 1].nodeValue, 'Test Page')
    const h1NodeIndex = nodes.findIndex(node => node.nodeName == 'H1')
    assert.equal(nodes[h1NodeIndex + 1].nodeName, '#text')
    assert.equal(nodes[h1NodeIndex + 1].nodeValue, 'Test')
    this.documentNodeId = data.root.nodeId
    const inputNode = nodes.find(node => node.nodeName == 'INPUT')
    this.inputNodeId = inputNode.nodeId
    const buttonNode = nodes.find(node => node.nodeName == 'BUTTON')
    this.buttonNodeId = buttonNode.nodeId
  }

  {
    const data = await googleChromeDevTools.DOM.querySelector({
      sessionId: this.sessionId,
      nodeId: this.documentNodeId,
      selector: 'input',
    })
    assert.equal(data.nodeId, this.inputNodeId)
  }

  console.log('Add first paragraph')

  await googleChromeDevTools.DOM.setAttributeValue({
    sessionId: this.sessionId,
    nodeId: this.inputNodeId,
    name: 'value',
    value: 'Test',
  })

  {
    const data = await googleChromeDevTools.DOM.querySelector({
      sessionId: this.sessionId,
      nodeId: this.documentNodeId,
      selector: 'button',
    })
    assert.equal(data.nodeId, this.buttonNodeId)
  }

  function getQuadMidpoint(quad) {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = quad
    return [(x1 + x2) / 2, (y1 + y4) / 2]
  }

  {
    const data = await googleChromeDevTools.DOM.getBoxModel({
      sessionId: this.sessionId,
      nodeId: this.buttonNodeId,
    })
    assert.equal(typeof data.model.width, 'number')
    assert.equal(typeof data.model.height, 'number')
    assert(Array.isArray(data.model.content))
    assert.equal(typeof data.model.content[0], 'number')
    assert.equal(typeof data.model.content[1], 'number')
    assert.equal(typeof data.model.content[2], 'number')
    assert.equal(typeof data.model.content[3], 'number')

    this.buttonMidpoint = getQuadMidpoint(data.model.content)
    assert.equal(this.buttonMidpoint.length, 2)
    assert.equal(typeof this.buttonMidpoint[0], 'number')
    assert.equal(typeof this.buttonMidpoint[1], 'number')
  }

  {
    const data1 = await googleChromeDevTools.DOM.querySelector({
      sessionId: this.sessionId,
      nodeId: this.documentNodeId,
      selector: 'p',
    })
    const nodeId = data1.nodeId
    assert.strictEqual(nodeId, 0)

    await assert.rejects(
      googleChromeDevTools.DOM.describeNode({
        sessionId: this.sessionId,
        nodeId,
        depth: 10,
      }),
      error => {
        return true
      }
    )
  }

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    x: this.buttonMidpoint[0],
    y: this.buttonMidpoint[1],
  })

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    x: this.buttonMidpoint[0],
    y: this.buttonMidpoint[1],
  })

  {
    const data1 = await googleChromeDevTools.DOM.querySelectorAll({
      sessionId: this.sessionId,
      nodeId: this.documentNodeId,
      selector: 'p',
    })
    assert.equal(data1.nodeIds.length, 1)
    const nodeId = data1.nodeIds[0]
    const data2 = await googleChromeDevTools.DOM.describeNode({
      sessionId: this.sessionId,
      nodeId,
      depth: 10,
    })
    const nodes = [...flattenNodes([data2.node])]
    assert.equal(nodes.length, 2)
    assert.equal(nodes[0].nodeName, 'P')
    assert.equal(nodes[1].nodeName, '#text')
    assert.equal(nodes[1].nodeValue, 'Test')
  }

  await googleChromeDevTools.DOM.setAttributeValue({
    sessionId: this.sessionId,
    nodeId: this.inputNodeId,
    name: 'value',
    value: '',
  })

  {
    const data = await googleChromeDevTools.DOM.getBoxModel({
      sessionId: this.sessionId,
      nodeId: this.inputNodeId,
    })
    assert.equal(typeof data.model.width, 'number')
    assert.equal(typeof data.model.height, 'number')
    assert(Array.isArray(data.model.content))
    assert.equal(typeof data.model.content[0], 'number')
    assert.equal(typeof data.model.content[1], 'number')
    assert.equal(typeof data.model.content[2], 'number')
    assert.equal(typeof data.model.content[3], 'number')

    this.inputMidpoint = getQuadMidpoint(data.model.content)
    assert.equal(this.inputMidpoint.length, 2)
    assert.equal(typeof this.inputMidpoint[0], 'number')
    assert.equal(typeof this.inputMidpoint[1], 'number')
  }

  console.log('Add second paragraph')

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    x: this.inputMidpoint[0],
    y: this.inputMidpoint[1],
  })

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    x: this.inputMidpoint[0],
    y: this.inputMidpoint[1],
  })

  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyDown',
    text: 'T',
  })
  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyUp',
  })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 'e' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 's' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 't' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: '2' })
  await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp' })

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    x: this.buttonMidpoint[0],
    y: this.buttonMidpoint[1],
  })

  {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })
    googleChromeDevTools.once('DOM.childNodeInserted', function handler(data) {
      resolve()
    })
    this.childNodeInsertedPromise = promise
  }

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    x: this.buttonMidpoint[0],
    y: this.buttonMidpoint[1],
  })

  await this.childNodeInsertedPromise

  {
    const data1 = await googleChromeDevTools.DOM.querySelectorAll({
      sessionId: this.sessionId,
      nodeId: this.documentNodeId,
      selector: 'p',
    })
    assert.equal(data1.nodeIds.length, 2)
    const nodeId = data1.nodeIds[1]
    const data2 = await googleChromeDevTools.DOM.describeNode({
      sessionId: this.sessionId,
      nodeId,
      depth: 10,
    })
    const nodes = [...flattenNodes([data2.node])]
    assert.equal(nodes.length, 2)
    assert.equal(nodes[0].nodeName, 'P')
    assert.equal(nodes[1].nodeName, '#text')
    assert.equal(nodes[1].nodeValue, 'Test2')
  }

  console.log('Add third paragraph')

  await googleChromeDevTools.DOM.focus({
    sessionId: this.sessionId,
    nodeId: this.inputNodeId,
  })

  await googleChromeDevTools.Runtime.evaluate({
    sessionId: this.sessionId,
    expression: 'const el = document.querySelector(\'input\'); el.value = \'\'; el.dispatchEvent(new Event(\'input\', { bubbles: true }));1',
  }).then(data => {
    assert.equal(data.result.type, 'number')
    assert.equal(data.result.value, 1)
  })

  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyDown',
    text: 'T',
  })
  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyDown',
    text: 'e',
  })
  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyDown',
    text: 's',
  })
  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyDown',
    text: 't',
  })
  await googleChromeDevTools.Input.dispatchKeyEvent({
    sessionId: this.sessionId,
    type: 'keyDown',
    text: '3',
  })

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    x: this.buttonMidpoint[0],
    y: this.buttonMidpoint[1],
  })

  {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })
    googleChromeDevTools.once('DOM.childNodeInserted', function handler(data) {
      resolve()
    })
    this.childNodeInsertedPromise = promise
  }

  await googleChromeDevTools.Input.dispatchMouseEvent({
    sessionId: this.sessionId,
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    x: this.buttonMidpoint[0],
    y: this.buttonMidpoint[1],
  })

  await this.childNodeInsertedPromise

  {
    const data1 = await googleChromeDevTools.DOM.querySelectorAll({
      sessionId: this.sessionId,
      nodeId: this.documentNodeId,
      selector: 'p',
    })
    assert.equal(data1.nodeIds.length, 3)
    const nodeId = data1.nodeIds[2]
    const data2 = await googleChromeDevTools.DOM.describeNode({
      sessionId: this.sessionId,
      nodeId,
      depth: 10,
    })
    const nodes = [...flattenNodes([data2.node])]
    assert.equal(nodes.length, 2)
    assert.equal(nodes[0].nodeName, 'P')
    assert.equal(nodes[1].nodeName, '#text')
    assert.equal(nodes[1].nodeValue, 'Test3')
  }

  await googleChromeDevTools.Runtime.evaluate({
    sessionId: this.sessionId,
    expression: 'el.value = \'\'; el.dispatchEvent(new Event(\'input\', { bubbles: true }));',
  })

  console.log('Storage')

  await googleChromeDevTools.Storage.clearCookies({
    sessionId: this.sessionId,
  })

  {
    const data = await googleChromeDevTools.Storage.getCookies({
      sessionId: this.sessionId,
    })
    assert.equal(data.cookies.length, 0)
  }

  await googleChromeDevTools.Storage.setCookies({
    sessionId: this.sessionId,
    cookies: [
      {
        name: 'test_cookie_1',
        value: 'test1',
        domain: `localhost:${PORT}`,
        path: '/',
      },
      {
        name: 'test_cookie_2',
        value: 'test2',
        domain: `localhost:${PORT}`,
        path: '/',
      }
    ]
  })

  {
    const data = await googleChromeDevTools.Storage.getCookies({
      sessionId: this.sessionId,
    })
    assert.equal(data.cookies.length, 2)
  }

  await googleChromeDevTools.Storage.clearCookies({
    sessionId: this.sessionId,
  })

  let closeResolve
  const closePromise = new Promise(_resolve => {
    closeResolve = _resolve
  })
  googleChromeDevTools.on('close', closeResolve)
  googleChromeDevTools.close()
  await closePromise

  /*
  server.close()

  await exec('ps aux | grep "Google Chrome for Testing" | awk \'{print $2}\' | xargs kill', {
    stdio: 'inherit',
  })
  */

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
