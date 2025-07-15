/**
 * @name XML
 *
 * @docs
 * ```coffeescript [specscript]
 * XML object
 * ```
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
    while (name.test(xml[i])) {
      i++
    }

    // tag name
    const $name = xml.slice(tagStart, i);

    // attributes
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
          throw SyntaxError('Expected quote for attribute value')
        }

        i++
        const valStart = i
        while (xml[i] != q) {
          i++
        }

        attributes[key] = xml.slice(valStart, i)
        i++
      }

      skipWS()
    }

    // self-closing tag
    if (xml[i] == '/') {
      i += 2
      return { $name, ...attributes, $children: [] }
    }

    i++

    // $children
    const $children = []
    let textStart = i

    while (true) {
      if (xml[i] == '<') {

        if (xml[i + 1] == '/') { // closing tag
          const text = xml.slice(textStart, i).trim()
          if (text) {
            $children.push(text)
          }
          i += 2

          const closeStart = i
          while (xml[i] != '>') {
            i++
          }
          const closeTag = xml.slice(closeStart, i);
          if (closeTag != $name) {
            throw SyntaxError(`Mismatched </${closeTag}> – expected </${$name}>`);
          }

          i++
          break

        } else { // child element
          const child = node()
          $children.push(child)
          textStart = i
        }

      } else {
        i++
      }

    }

    return { $name, ...attributes, $children }
  }

  const root = node()

  if (i != xml.length) {
    throw SyntaxError('Extra content')
  }

  return root
}

/**
 * @name parseXML
 *
 * @docs
 * ```coffeescript [specscript]
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
 * parseXML(xml string) -> ast RootAST
 * ```
 */
function parseXML(xml) {
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
    return { ...ast, ..._parseTags(xml) }
  }

  return ast
}

XML.parse = parseXML

module.exports = XML
