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
  xml = xml.trim();
  let i = 0;

  const ws   = /\s/;        // whitespace characters
  const name = /[^\s/>]/;   // a single “name” rune

  /* ------------------------------------------------------------- */
  /* helpers                                                       */
  /* ------------------------------------------------------------- */
  function skipWS() {
    while (ws.test(xml[i])) i++;
  }

  /* ------------------------------------------------------------- */
  /* recursive-descent element parser                              */
  /* ------------------------------------------------------------- */
  function node() {
    if (xml[i] !== '<' || xml[i + 1] === '/') {
      throw new SyntaxError('Malformed tag');
    }

    /* ---------- open-tag ---------- */
    i++;                                 // skip '<'
    const tagStart = i;
    while (name.test(xml[i])) i++;
    const $name = xml.slice(tagStart, i); // tag name

    /* ---------- attributes -------- */
    const attributes = {};
    skipWS();

    while (xml[i] !== '>' && xml[i] !== '/') {
      const keyStart = i;
      while (!ws.test(xml[i]) && xml[i] !== '=') i++;
      const key = xml.slice(keyStart, i);

      skipWS();

      if (xml[i] === '=') {
        i++;
        skipWS();

        const q = xml[i];
        if (q !== '"' && q !== "'") {
          throw new SyntaxError('Expected quote for attribute value');
        }

        i++;                         // skip opening quote
        const valStart = i;
        while (xml[i] !== q) i++;
        attributes[key] = xml.slice(valStart, i);
        i++;                         // skip closing quote
      }

      skipWS();
    }

    /* ---------- self-closing? ----- */
    if (xml[i] === '/') {
      i += 2;                        // skip "/>"
      return { $name, ...attributes, $children: [] };
    }

    i++;                             // skip '>'

    /* ---------- children / text --- */
    const $children = [];
    let textStart = i;

    while (true) {
      if (xml[i] === '<') {

        /* ‼️ NEW: flush text that appears **before** a child or closing tag */
        const raw = xml.slice(textStart, i);
        const trimmed = raw.trim();
        if (trimmed) $children.push(trimmed);

        if (xml[i + 1] === '/') {            //   </tag>
          i += 2;                            // skip '</'
          const closeStart = i;
          while (xml[i] !== '>') i++;
          const closeTag = xml.slice(closeStart, i);
          if (closeTag !== $name) {
            throw new SyntaxError(
              `Mismatched </${closeTag}> – expected </${$name}>`
            );
          }
          i++;                               // skip '>'
          break;                             // element done
        }

        /* ---------- nested element ----- */
        const child = node();
        $children.push(child);
        textStart = i;                       // reset text buffer start

      } else {
        i++;                                 // plain character, keep scanning
      }
    }

    return { $name, ...attributes, $children };
  }

  /* ------------------------------------------------------------- */
  /* kick-off and final sanity check                               */
  /* ------------------------------------------------------------- */
  const root = node();
  if (i !== xml.length) {
    throw new SyntaxError('Extra content');
  }
  return root;
}

/**
 * @name normalize
 *
 * @docs
 * ```coffeescript [specscript]
 * type AST = {
 *   $name: string,
 *   $children: Array<string|AST>,
 *   ...attributes
 * }
 *
 * type NestedArray = Array<NestedObject|NestedArray|string>
 * type NestedObject = Object<NestedObject|NestedArray|string>
 *
 * normalize(node string|AST) -> data NestedObject|string
 * ```
 */
function normalize(node) {
  if (typeof node == 'string') {
    return node
  }

  const result = {}
  for (const key in node) {
    const value = node[key]
    if (!key.startsWith('$')) {
      result[key] = value
    }
  }

  if (!node.$children || node.$children.length === 0) {
    return Object.keys(result).length > 0 ? result : null
  }

  if (
    node.$children.length == 1 &&
    typeof node.$children[0] == 'string' &&
    Object.keys(result).length == 0
  ) {
    return node.$children[0]
  }

  for (const child of node.$children) {
    const key = child.$name
    const value = normalize(child)

    if (Object.prototype.hasOwnProperty.call(result, key)) {
      if (Array.isArray(result[key])) {
        result[key].push(value)
      } else {
        result[key] = [result[key], value]
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * @name _convert
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
 * type NestedArray = Array<NestedObject|NestedArray|string>
 * type NestedObject = Object<NestedObject|NestedArray|string>
 *
 * _convert(tree RootAST) -> data NestedObject
 * ```
 */
function _convert(tree) {
  const rootKey = tree.$name
  return { [rootKey]: normalize(tree) }
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
