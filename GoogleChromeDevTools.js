const EventEmitter = require('events')
const GoogleChromeForTesting = require('./GoogleChromeForTesting')
const WebSocket = require('./WebSocket')

let id = 0
function getId() {
  return id += 1
}

/**
 * @name sendRequestJSON
 *
 * @docs
 * ```coffeescript [specscript]
 * sendRequestJSON(payload string) -> data Promise<Object>
 * ```
 */
async function sendRequestJSON(payload) {
  let resolve
  const promise = new Promise(_resolve => {
    resolve = _resolve
  })

  const handler = function (message) {
    const data = JSON.parse(message.toString('utf8'))
    if (data.id == id) {
      resolve(data)
    }
  }

  this.websocket.on('message', handler)
  this.websocket.send(payload)

  const data = await promise
  this.websocket.removeListener('message', handler)

  return data.result
}

/**
 * @name _Method
 *
 * @docs
 * ```coffeescript [specscript]
 * _Method(method string, {
 *   sessionId: string,
 *   ...params Object
 * }) -> data Promise<Object>
 * ```
 */
async function _Method(method, { sessionId, ...params }) {
  const id = getId()

  const payload = JSON.stringify({
    sessionId: sessionId ?? this.sessionId,
    id,
    method,
    params,
  })

  const data = await sendRequestJSON.call(this, payload)

  if (data.error) {
    const error = new Error(data.error.message)
    error.code = data.error.code
    throw error
  }

  return data
}

class GoogleChromeDevToolsTarget {
  constructor(websocket) {
    this.websocket = websocket
  }

  /**
   * @name Target.getTargets
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPTarget 'https://chromedevtools.github.io/devtools-protocol/tot/Target/'
   *
   * Target.getTargets() -> data Promise<{
   *   targetInfos: Array<CDPTarget.TargetInfo>,
   * }>
   * ```
   *
   * Retrieves a list of available targets.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `targetInfos` - [`Array<CDPTarget.TargetInfo>`](https://chromedevtools.github.io/devtools-protocol/tot/Target/#type-TargetInfo) - an array of information about the available targets.
   *
   * ```javascript
   * const data = await googleChromeDevTools.Target.getTargets()
   * ```
   */
  getTargets(options = {}) {
    return _Method.call(this, 'Target.getTargets', options)
  }

  /**
   * @name Target.attachToTarget
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPTarget 'https://chromedevtools.github.io/devtools-protocol/tot/Target/'
   *
   * Target.attachToTarget(options {
   *   targetId: CDPTarget.TargetID,
   * }) -> data Promise<{
   *   sessionId: string,
   * }>
   * ```
   *
   * Attaches to a target and creates a new session.
   *
   * Arguments:
   *   * `options`
   *     * `target` - the target ID.
   *
   * Return:
   *   * `data`
   *     * `sessionId` - the ID of the new session.
   *
   * ```javascript
   * const data = await googleChromeDevTools.Target.attachToTarget()
   * ```
   */
  attachToTarget(options = {}) {
    return _Method.call(this, 'Target.attachToTarget', options)
  }
}

class GoogleChromeDevToolsPage {
  constructor(websocket) {
    this.websocket = websocket
  }

  /**
   * @name Page.navigate
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPPage 'https://chromedevtools.github.io/devtools-protocol/tot/Page/'
   *
   * Page.navigate(options {
   *   sessionId: string,
   *   url: string,
   * }) -> data Promise<{
   *   frameId: CDPPage.FrameID,
   * }>
   * ```
   *
   * Navigates the current page to a url.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `url` - the url to navigate to.
   *
   * Return:
   *   * `data`
   *     * `frameId` - [`Page.FrameId`](https://chromedevtools.github.io/devtools-protocol/tot/Page/#type-FrameId) - the ID of the document context (top-level page or `<iframe>`).
   *
   * ```javascript
   * await googleChromeDevTools.Page.navigate({
   *   url: 'http://localhost:3000/',
   * })
   * ```
   */
  navigate(options = {}) {
    return _Method.call(this, 'Page.navigate', options)
  }
}

/**
 * @name Event: DOM.attributeModified
 */

/**
 * @name Event: DOM.attributeRemoved
 */

/**
 * @name Event: DOM.characterDataModified
 */

/**
 * @name Event: DOM.childNodeCountUpdated
 */

/**
 * @name Event: DOM.childNodeInserted
 */

/**
 * @name Event: DOM.childNodeRemoved
 */

/**
 * @name Event: DOM.documentUpdated
 */

/**
 * @name Event: DOM.setChildNodes
 */

class GoogleChromeDevToolsDOM {
  constructor(websocket) {
    this.websocket = websocket
  }

  /**
   * @name DOM.enable
   *
   * @docs
   * ```coffeescript [specscript]
   * DOM.enable(options {
   *   sessionId: string,
   * }) -> data Promise<{}>
   * ```
   *
   * Enables DOM events for the current target.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.DOM.enable()
   * ```
   */
  enable(options = {}) {
    return _Method.call(this, 'DOM.enable', options)
  }

  /**
   * @name DOM.getDocument
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPDOM 'https://chromedevtools.github.io/devtools-protocol/tot/DOM/'
   *
   * DOM.getDocument(options {
   *   sessionId: string,
   *   depth: number,
   * }) -> data Promise<{
   *   root: CDPDOM.Node,
   * }>
   * ```
   *
   * Returns the root DOM node and subtree. Enables DOM domain events for the current target.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `depth` - the maximum depth of the subtree. Defaults to `1`. Use `-1` for the entire subtree.
   *
   * Return:
   *   * `data`
   *     * `root` - the root DOM node and subtree.
   *
   * ```javascript
   * const data = await googleChromeDevTools.DOM.getDocument({ depth: 10 })
   * ```
   */
  getDocument(options = {}) {
    return _Method.call(this, 'DOM.getDocument', options)
  }

  /**
   * @name DOM.querySelector
   *
   * @docs
   * ```coffeescript [specscript]
   * DOM.querySelector(options {
   *   sessionId: string,
   *   nodeId: string,
   *   selector: string,
   * }) -> data Promise<{
   *   nodeId: string,
   * }>
   * ```
   *
   * Executes a query selector on a node.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `nodeId` - the ID of the node to query.
   *     * `selector` - the query selector to execute.
   *
   * Return:
   *   * `data`
   *     * `nodeId` - the first node ID that matches the query selector.
   *
   * ```javascript
   * const data = await googleChromeDevTools.DOM.querySelector({
   *   nodeId: 1,
   *   selector: 'form > button[type="submit"]',
   * })
   * ```
   *
   * References:
   *   * [Selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Selectors#selectors)
   */
  querySelector(options = {}) {
    return _Method.call(this, 'DOM.querySelector', options)
  }

  /**
   * @name DOM.querySelectorAll
   *
   * @docs
   * ```coffeescript [specscript]
   * DOM.querySelectorAll(options {
   *   sessionId: string,
   *   nodeId: string,
   *   selector: string,
   * }) -> data Promise<{
   *   nodeIds: Array<string>,
   * }>
   * ```
   *
   * Executes a query selector on a node, returning all node IDs that match the selector.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `nodeId` - the ID of the node to query.
   *     * `selector` - the query selector to execute.
   *
   * Return:
   *   * `data`
   *     * `nodeIds` - an array of the node IDs that match the query selector.
   *
   * ```javascript
   * const data = await googleChromeDevTools.DOM.querySelectorAll({
   *   nodeId: 1,
   *   selector: 'nav > a',
   * })
   * ```
   *
   * References:
   *   * [Selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Selectors#selectors)
   */
  querySelectorAll(options = {}) {
    return _Method.call(this, 'DOM.querySelectorAll', options)
  }

  /**
   * @name DOM.getBoxModel
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPDOM 'https://chromedevtools.github.io/devtools-protocol/tot/DOM/'
   *
   * DOM.getBoxModel(options {
   *   sessionId: string,
   *   nodeId: string,
   * }) -> data Promise<{
   *   model: CDPDOM.BoxModel,
   * }>
   * ```
   *
   * Returns the box model of a node.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `nodeId` - the ID of the node to query.
   *
   * Return:
   *   * `data`
   *     * `model` - [`CDPDOM.BoxModel`](https://chromedevtools.github.io/devtools-protocol/tot/DOM/#type-BoxModel) - the box model for the node.
   *
   * ```javascript
   * const data = await googleChromeDevTools.DOM.getBoxModel({ nodeId: 32 })
   * ```
   *
   * References:
   *   * [Box Model](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model)
   */
  getBoxModel(options = {}) {
    return _Method.call(this, 'DOM.getBoxModel', options)
  }

  /**
   * @name DOM.describeNode
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPDOM 'https://chromedevtools.github.io/devtools-protocol/tot/DOM/'
   *
   * DOM.describeNode(options {
   *   sessionId: string,
   *   nodeId: string,
   * }) -> data Promise<{
   *   node: CDPDOM.Node,
   * }>
   * ```
   *
   * Describes a node.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `nodeId` - the ID of the node to describe.
   *
   * Return:
   *   * `data`
   *     * `node` - [`CDPDOM.Node`](https://chromedevtools.github.io/devtools-protocol/tot/DOM/#type-Node) - the node description.
   *
   * ```javascript
   * const data = await googleChromeDevTools.DOM.describeNode({ nodeId: 1 })
   * ```
   */
  describeNode(options = {}) {
    return _Method.call(this, 'DOM.describeNode', options)
  }

  /**
   * @name DOM.setAttributeValue
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPDOM 'https://chromedevtools.github.io/devtools-protocol/tot/DOM/'
   *
   * DOM.setAttributeValue(options {
   *   sessionId: string,
   *   nodeId: string,
   *   name: string,
   *   value: string,
   * }) -> data Promise<{}>
   * ```
   *
   * Sets the value of an attribute for a node.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `nodeId` - the ID of the node.
   *     * `name` - the name of the attribute to set.
   *     * `value` - the value to set for the attribute.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.DOM.setAttributeValue({
   *   nodeId: 19,
   *   name: 'value',
   *   value: 'Example',
   * })
   * ```
   */
  setAttributeValue(options = {}) {
    return _Method.call(this, 'DOM.setAttributeValue', options)
  }

  /**
   * @name DOM.focus
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPDOM 'https://chromedevtools.github.io/devtools-protocol/tot/DOM/'
   *
   * DOM.focus(options {
   *   sessionId: string,
   *   nodeId: string,
   * }) -> data Promise<{}>
   * ```
   *
   * Focuses the element or node.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `nodeId` - the ID of the node.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.DOM.focus({ nodeId: 21 })
   * ```
   */
  focus(options = {}) {
    return _Method.call(this, 'DOM.focus', options)
  }

}

class GoogleChromeDevToolsInput {
  constructor(websocket) {
    this.websocket = websocket
  }

  /**
   * @name Input.dispatchMouseEvent
   *
   * @docs
   * ```coffeescript [specscript]
   * Input.dispatchMouseEvent(options {
   *   sessionId: string,
   *   type: 'mousePressed'|'mouseReleased'|'mouseMoved'|'mouseWheel',
   *   button: 'none'|'left'|'middle'|'right'|'back'|'forward',
   *   clickCount: number,
   *   x: number,
   *   y: number,
   * }) -> data Promise<{}>
   * ```
   *
   * Dispatches a mouse event to the page.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `type` - the type of mouse event.
   *     * `button` - the mouse button.
   *     * `clickCount` - the number of times to click the mouse button.
   *     * `x` - the x-coordinate of the event relative to the main frame's viewport.
   *     * `y` - the y-coordinate of the event relative to the main frame's viewport.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.Input.dispatchMouseEvent({
   *   type: 'mousePressed',
   *   button: 'left',
   *   clickCount: 1,
   *   x: 500,
   *   y: 500,
   * })
   * ```
   */
  dispatchMouseEvent(options = {}) {
    return _Method.call(this, 'Input.dispatchMouseEvent', options)
  }

  /**
   * @name Input.dispatchKeyEvent
   *
   * @docs
   * ```coffeescript [specscript]
   * Input.dispatchKeyEvent(options {
   *   sessionId: string,
   *   type: 'keyDown'|'keyUp'|'rawKeyDown'|'char',
   *   text: string,
   * }) -> data Promise<{}>
   * ```
   *
   * Dispatches a key event to the page.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `type` - the type of key event.
   *     * `text` - the text generated by processing a virtual key code with a keyboard layout.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 'T' })
   * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp' })
   * ```
   */
  dispatchKeyEvent(options = {}) {
    return _Method.call(this, 'Input.dispatchKeyEvent', options)
  }

}

class GoogleChromeDevToolsStorage {
  constructor(websocket) {
    this.websocket = websocket
  }

  /**
   * @name Storage.clearCookies
   *
   * @docs
   * ```coffeescript [specscript]
   * Storage.clearCookies(options {
   *   sessionId: string,
   * }) -> data Promise<{}>
   * ```
   *
   * Clears the cookies of the target.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.Storage.clearCookies()
   * ```
   */
  clearCookies(options = {}) {
    return _Method.call(this, 'Storage.clearCookies', options)
  }

  /**
   * @name Storage.getCookies
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPNetwork 'https://chromedevtools.github.io/devtools-protocol/tot/Network/'
   *
   * Storage.getCookies(options {
   *   sessionId: string,
   * }) -> data Promise<{
   *   cookies: Array<CDPNetwork.Cookie>,
   * }>
   * ```
   *
   * Gets the cookies of the target.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *
   * Return:
   *   * `data`
   *     * `cookies` - [`CDPNetwork.Cookie`](https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-Cookie) - An array of cookie objects.
   *
   * ```javascript
   * const data = await googleChromeDevTools.Storage.getCookies()
   * ```
   */
  getCookies(options = {}) {
    return _Method.call(this, 'Storage.getCookies', options)
  }

  /**
   * @name Storage.setCookies
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPNetwork 'https://chromedevtools.github.io/devtools-protocol/tot/Network/'
   *
   * Storage.setCookies(options {
   *   sessionId: string,
   *   cookies: Array<CDPNetwork.CookieParam>,
   * }) -> data Promise<{}>
   * ```
   *
   * Sets the cookies of the target.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `cookies` - [`Array<CDPNetwork.CookieParam>`](https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-CookieParam) - the cookies to be set.
   *
   * Return:
   *   * `data` - promise of an empty object.
   *
   * ```javascript
   * await googleChromeDevTools.Storage.setCookies({
   *   cookies: [
   *     {
   *       name: 'cookie1',
   *       value: 'example1',
   *       domain: 'localhost:3000',
   *       path: '/',
   *     },
   *     {
   *       name: 'cookie2',
   *       value: 'example2',
   *       domain: 'localhost:3000',
   *       path: '/',
   *     }
   *   ],
   * })
   * ```
   */
  setCookies(options = {}) {
    return _Method.call(this, 'Storage.setCookies', options)
  }
}

class GoogleChromeDevToolsRuntime {
  constructor(websocket) {
    this.websocket = websocket
  }

  /**
   * @name Runtime.evaluate
   *
   * @docs
   * ```coffeescript [specscript]
   * module CDPRuntime 'https://chromedevtools.github.io/devtools-protocol/tot/Runtime/'
   *
   * Runtime.evaluate(options {
   *   sessionId: string,
   *   expression: string,
   * }) -> data Promise<{
   *   result: CDPRuntime.RemoteObject,
   *   exceptionDetails: CDPRuntime.ExceptionDetails,
   * }>
   * ```
   *
   * Evaluates an expression on the global object.
   *
   * Arguments:
   *   * `options`
   *     * `sessionId` - the session ID.
   *     * `expression` - the expression to evaluate.
   *
   * Return:
   *   * `data`
   *     * `result` - [`CDPRuntime.RemoteObject`](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#type-RemoteObject) - the evaluation result.
   *     * `exceptionDetails` - [`CDPRuntime.ExceptionDetails`](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#type-ExceptionDetails) - detailed information about any exceptions or errors that were thrown during evaluation.
   *
   * ```javascript
   * const expression = 'document.querySelector(\'button[type="submit"]\').click();'
   * await googleChromeDevTools.Runtime.evaluate({ expression })
   * ```
   */
  evaluate(options = {}) {
    return _Method.call(this, 'Runtime.evaluate', options)
  }

}

/**
 * @name GoogleChromeDevTools
 *
 * @constructor
 *
 * @docs
 * ```coffeescript [specscript]
 * new GoogleChromeDevTools(
 *   googleChromeForTesting GoogleChromeForTesting
 * ) -> googleChromeDevTools GoogleChromeDevTools
 *
 * new GoogleChromeDevTools(options {
 *   chromeVersion: 'stable'|'beta'|'dev'|'canary'|string,
 *   chromeDir: string,
 *   remoteDebuggingPort: number,
 *   headless: boolean,
 *   userDataDir: string,
 *   useMockKeychain: boolean,
 * }) -> googleChromeDevTools GoogleChromeDevTools
 * ```
 *
 * Presidium GoogleChromeDevTools client for test automation.
 *
 * Arguments:
 *   * `googleChromeForTesting` - an instance of a Presidium [GoogleChromeForTesting](/docs/GoogleChromeForTesting) client.
 *   * `options`
 *     * `chromeVersion` - the version of Google Chrome for Testing to download. Defaults to `'stable'`.
 *     * `chromeDir` - the directory that Google Chrome for Testing will install to. Defaults to ``google-chrome-for-testing'`.
 *     * `remoteDebuggingPort` - the port that the Chrome DevTools Protocol server will listen on. Defaults to `9222`
 *     * `headless` - whether to run Google Chrome for Testing in headless mode. Defaults to `false`.
 *     * `userDataDir` - directory for storing user profile data such as history, bookmarks, cookies, and settings. Defaults to `tmp/chrome`.
 *     * `useMockKeychain` - whether to use a mock keychain instead of the system's real security keychain. Defaults to `true`.
 *
 * Returns:
 *   * `googleChromeDevTools` - an instance of the Presidium GoogleChromeDevTools client.
 *
 * ```javascript
 * const googleChromeForTesting = new GoogleChromeForTesting()
 * await googleChromeForTesting.init()
 *
 * const googleChromeDevTools = new GoogleChromeDevTools(googleChromeForTesting)
 * await googleChromeDevTools.init()
 *
 * const target = await googleChromeDevTools.Target.getTargets()
 *   .then(data => data.result.targetInfos[0])
 *
 * const sessionId = await googleChromeDevTools.Target.attachToTarget({
 *   targetId: target.targetId,
 *   flatten: true,
 * }).then(data => data.result.sessionId)
 *
 * googleChromeDevTools.setSessionId(sessionId)
 *
 * await googleChromeDevTools.Page.navigate({
 *   url: 'http://localhost:7357/',
 * })
 *
 * const documentNodeId = await googleChromeDevTools.DOM.getDocument()
 *   .then(data => data.result.root.nodeId)
 *
 * const inputNodeId = await googleChromeDevTools.DOM.querySelector({
 *   nodeId: documentNodeId,
 *   selector: 'input',
 * }).then(data => data.result.nodeId)
 *
 * await googleChromeDevTools.DOM.focus({ nodeId: inputNodeId })
 *
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 'T' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp', text: 'T' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 'e' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp', text: 'e' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 's' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp', text: 's`' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyDown', text: 't' })
 * await googleChromeDevTools.Input.dispatchKeyEvent({ type: 'keyUp', text: 't' })
 * ```
 *
 * The Chrome DevTools Protocol has various APIs to interact with the different parts of the browser. These parts are separated into different domains. The Presidium GoogleChromeDevTools client covers the `Target`, `Page`, `DOM`, `Input`, `Storage`, and `Runtime` domains. Pages, serviceworkers, and extensions are called "Targets" and can be fetched and tracked using the `Target` domain.
 *
 * Every Chrome DevTools Protocol client needs to first attach to the target using the `Target.attachToTarget` command. The command will establish a protocol session with the given target and return a `sessionId`. The returned `sessionId` should be set on the `GoogleChromeDevTools` client using [`setSessionId`](#setSessionId) or included in every message to the DevTools server.
 *
 * ```javascript
 * const googleChromeForTesting = new GoogleChromeForTesting()
 * await googleChromeForTesting.init()
 *
 * const googleChromeDevTools = new GoogleChromeDevTools(googleChromeForTesting)
 * await googleChromeDevTools.init()
 *
 * // get targets
 * const targetsData = await googleChromeDevTools.Target.getTargets()
 * const pageTarget = targetsData.result.targetInfos.find(info => info.type == 'page')
 *
 * // attach to target
 * const attachToTargetData = await googleChromeDevTools.Target.attachToTarget({
 *   targetId: this.pageTarget.targetId,
 *   flatten: true,
 * })
 * const sessionId = attachToTargetData.result.sessionId
 *
 * // navigate to the home page
 * const data = await googleChromeDevTools.Page.navigate({
 *   sessionId: this.sessionId,
 *   url: `http://localhost:3000/`,
 * })
 * ```
 *
 * References:
 *   * [Getting Started with the Chrome Devtools Protocol](https://github.com/aslushnikov/getting-started-with-cdp/blob/master/README.md)
 *   * [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/)
 *
 * Supported platforms:
 *   * `mac-arm64`
 *   * `linux64`
 *
 * ## Further Installation
 * Some further installation may be required for Linux platforms.
 *
 * ### Install headless dependencies for Amazon Linux 2023 / Red Hat
 * ```sh
 * sudo dnf install -y cairo pango nss nspr atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm alsa-lib
 * ```
 *
 * ### Install headless dependencies for Ubuntu / Debian
 * ```sh
 * sudo apt-get update && sudo apt-get install -y libcairo2 libpango-1.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdrm-dev libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm-dev libasound2-dev
 *
 * # disable AppArmor unprivileged security restriction
 * echo "kernel.apparmor_restrict_unprivileged_userns=0" | sudo tee /etc/sysctl.d/60-apparmor-namespace.conf
 * sudo sysctl -p /etc/sysctl.d/60-apparmor-namespace.conf
 * ```
 */
class GoogleChromeDevTools extends EventEmitter {
  constructor(options = {}) {
    super()

    if (options.constructor == GoogleChromeForTesting) {
      this.googleChromeForTesting = options
    }

    this.chromeVersion = options.chromeVersion ?? 'stable'
    this.chromeDir = options.chromeDir ?? 'google-chrome-for-testing'
    this.remoteDebuggingPort = options.remoteDebuggingPort ?? 9222
    this.headless = options.headless ?? false
    this.userDataDir = options.userDataDir ?? 'tmp/chrome'
    this.useMockKeychain = options.useMockKeychain ?? true
  }

  /**
   * @name init
   *
   * @docs
   * ```coffeescript [specscript]
   * init() -> promise Promise<>
   * ```
   *
   * Initializes the `GoogleChromeDevTools` client.
   *
   * Arguments:
   *   * (none)
   *
   * Returns:
   *   * `promise` - a promise that resolves when the initialization process is done.
   *
   * ```javascript
   * const googleChromeDevTools = new GoogleChromeDevTools()
   *
   * await googleChromeDevTools.init()
   * ```
   */
  async init() {
    this.googleChromeForTesting ??= new GoogleChromeForTesting({
      chromeVersion: this.chromeVersion,
      chromeDir: this.chromeDir,
      remoteDebuggingPort: this.remoteDebuggingPort,
      headless: this.headless,
      userDataDir: this.userDataDir,
      useMockKeychain: this.useMockKeychain,
    })
    await this.googleChromeForTesting.init()

    this.websocket = new WebSocket(this.googleChromeForTesting.devtoolsUrl, {
      offerPerMessageDeflate: false,
    })
    this.websocket.on('error', error => {
      throw error
    })

    this.websocket.on('message', message => {
      const data = JSON.parse(message.toString('utf8'))
      if (data.method) {
        console.log('Event:', data.method, JSON.stringify(data.params))
        this.emit(data.method, data.params)
      }
    })

    this.Target = new GoogleChromeDevToolsTarget(this.websocket)
    this.Page = new GoogleChromeDevToolsPage(this.websocket)
    this.DOM = new GoogleChromeDevToolsDOM(this.websocket)
    this.Input = new GoogleChromeDevToolsInput(this.websocket)
    this.Storage = new GoogleChromeDevToolsStorage(this.websocket)
    this.Runtime = new GoogleChromeDevToolsRuntime(this.websocket)

    await new Promise(resolve => {
      this.websocket.on('open', resolve)
    })
  }

  /**
   * @name setSessionId
   *
   * @docs
   * ```coffeescript [specscript]
   * setSessionId(sessionId string) -> undefined
   * ```
   *
   * Sets the session ID for the GoogleChromeDevTools client.
   *
   * Arguments:
   *   * `sessionId` - the ID of the session.
   *
   * Return:
   *   * `undefined`
   *
   * ```javascript
   * const data = await googleChromeDevTools.Target.attachToTarget()
   * googleChromeDevTools.setSessionId(data.sessionId)
   * ```
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId
    this.Page.sessionId = sessionId
    this.DOM.sessionId = sessionId
    this.Input.sessionId = sessionId
    this.Storage.sessionId = sessionId
    this.Runtime.sessionId = sessionId
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * close() -> undefined
   * ```
   *
   * Closes the websocket connection to the DevTools server and terminates the Google Chrome for Testing process.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `undefined`
   *
   * ```javascript
   * googleChromeDevTools.close()
   * ```
   */
  close() {
    this.websocket.sendClose()
    this.websocket.on('close', () => {
      this.googleChromeForTesting.close()
      this.emit('close')
    })
  }
}

module.exports = GoogleChromeDevTools
