/**
 * @name XML
 *
 * @docs
 * Presidium XML class.
 */
const XML = {}

/**
 * @name _parseTags
 *
 * @docs
 * ```coffeescript [specscript]
 * attributes Object<string>
 *
 * type AST = {
 *   $name: string,
 *   $children: Array<string|AST>,
 *   ...attributes
 * }
 *
 * _parseTags(xml string) -> ast AST
 * ```
 */
function _parseTags(xml) {
  xml = xml.trim()
  let i = 0

  const ws   = /\s/
  const name = /[^\s/>]/

  function skipWS() {
    while (ws.test(xml[i])) {
      i++
    }
  }

  function node() {
    if (xml[i] != '<' || xml[i + 1] == '/') {
      throw new SyntaxError('Malformed tag')
    }

    i++
    const tagStart = i
    while (name.test(xml[i])) i++
    const $name = xml.slice(tagStart, i)

    const attributes = {}
    skipWS()

    while (xml[i] != '>' && xml[i] != '/') {
      const keyStart = i
      while (!ws.test(xml[i]) && xml[i] != '=') {
        i++
      }
      const key = xml.slice(keyStart, i)

      skipWS()

      if (xml[i] == '=') {
        i++
        skipWS()

        const q = xml[i]
        if (q != '"' && q != "'") {
          throw new SyntaxError('Expected quote for attribute value')
        }

        i++
        const valStart = i
        while (xml[i] !== q) i++
        attributes[key] = xml.slice(valStart, i)
        i++
      }

      skipWS()
    }

    if (xml[i] == '/') {
      i += 2
      return { $name, ...attributes, $children: [] }
    }

    i++

    const $children = []
    let textStart = i

    while (true) {
      if (xml[i] == '<') {

        const raw = xml.slice(textStart, i)
        const trimmed = raw.trim()
        if (trimmed) $children.push(trimmed)

        if (xml[i + 1] === '/') {
          i += 2
          const closeStart = i
          while (xml[i] != '>') {
            i++
          }
          const closeTag = xml.slice(closeStart, i)
          if (closeTag != $name) {
            throw new SyntaxError(
              `Mismatched </${closeTag}> – expected </${$name}>`
            )
          }
          i++
          break
        }

        const child = node()
        $children.push(child)
        textStart = i

      } else {
        i++
      }
    }

    return { $name, ...attributes, $children };
  }

  const root = node()
  if (i != xml.length) {
    throw new SyntaxError('Extra content')
  }

  return root
}

/**
 * @name _String
 *
 * @docs
 * ```coffeescript [specscript]
 * _String(value string, attributes object) -> string|String { ...attributes }
 * ```
 */
function _String(value, attributes) {
  if (Object.keys(attributes).length > 0) {
    const result = new String(value)
    Object.assign(result, attributes)
    return result
  }
  return value
}

/**
 * @name _convert
 *
 * @docs
 * ```coffeescript [specscript]
 * type AST = {
 *   $preamble: object,
 *   $name: string,
 *   $children: Array<string|AST>,
 *   ...attributes
 * }
 *
 * _convert(ast AST) -> data object
 * ```
 */
function _convert(ast) {
  const { $preamble, $name, $children, ...attributes } = ast

  const result = {}

  if ($children.length == 0) {

    if (Object.keys(attributes).length > 0) {
      result[$name] = attributes
    } else {
      result[$name] = ''
    }

  } else {
    for (const child of $children) {
      if (typeof child == 'string') { // child string

        if (result[$name]) {
          if (Array.isArray(result[$name])) {
            result[$name].push(_String(child, attributes))
          } else {
            result[$name] = [result[$name], _String(child, attributes)]
          }
        } else {
          result[$name] = _String(child, attributes)
        }

      } else { // child ast
        if (result[$name]) {

          if (typeof result[$name] == 'string') {
            result[$name] = [result[$name], _convert(child)]
          } else if (child.$name in result[$name]) { // create array under child.$name

            if (Array.isArray(result[$name][child.$name])) {
              result[$name][child.$name].push(_convert(child)[child.$name])
            } else {
              result[$name][child.$name] = [
                result[$name][child.$name],
                _convert(child)[child.$name]
              ]
            }

          } else {
            result[$name] = Object.assign(result[$name], _convert(child))
            Object.assign(result[$name], attributes)
          }

        } else {
          result[$name] = _convert(child)
          Object.assign(result[$name], attributes)
        }

      }

    }
  }

  return result
}

/**
 * @name XML.parse
 *
 * @docs
 * ```coffeescript [specscript]
 * attributes Object<string>
 *
 * type AST = {
 *   $name: string,
 *   $children: Array<string|AST>,
 *   ...attributes
 * }
 *
 * type RootAST = {
 *   $preamble: {
 *     version: string,
 *     encoding: string
 *   },
 *   $name: string,
 *   $children: Array<string|AST>,
 *   ...attributes
 * }
 *
 * type NestedArray = Array<NestedObject|NestedArray|string>
 * type NestedObject = Object<NestedObject|NestedArray|string>
 *
 * XML.parse(xml string) -> data NestedObject
 * XML.parse(xml string, options { ast: true }) -> ast RootAST
 * ```
 *
 * Parses [XML](https://en.wikipedia.org/wiki/XML) into JSON data.
 *
 * Arguments:
 *   * `xml` - an XML string.
 *   * `options`
 *     * `ast` - whether to return an AST (Abstract Syntax Tree) of the XML string.
 *
 * Return:
 *   * `data` - the JSON data parsed from the `xml` string, or if `ast` is true, the AST (Abstract Syntax Tree) of the XML string.
 *
 * ```javascript
 * const data = XML.parse(`
 * <Example a="1">
 *   <Attr>Content</Attr>
 * </Example>
 * `)
 *
 * console.log(data) // { Example: { Attr: 'Content', a: '1' } }
 * ```
 */
XML.parse = function parse(xml, options = {}) {
  xml = xml.replace(/\n/g, '')
  xml = xml.trim()
  const ast = {}

  {
    const mpreamble = /^<\?xml.*\?>/.exec(xml)
    if (mpreamble) {
      ast.$preamble = {}
      const mpairs = mpreamble[0].match(/\w+\=".*?"/g)
      for (const pair of mpairs) {
        const [key, quoted] = pair.split('=')
        ast.$preamble[key] = quoted.replace(/^"/, '').replace(/"$/, '')
      }
      xml = xml.replace(/^<\?xml.*\?>/, '')
    }
  }

  if (xml) {
    Object.assign(ast, _parseTags(xml))
  }

  if (options.ast) {
    return ast
  }

  return _convert(ast)
}

module.exports = XML
