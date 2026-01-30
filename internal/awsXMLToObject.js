const XML = require('../XML')

/*
<?xml version="1.0" encoding="UTF-8"?>
<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2</ID>
    <DisplayName>solumlibs</DisplayName>
  </Owner>

  <AccessControlList>
    <Grant>
      <Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser">
        <ID>370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2</ID>
        <DisplayName>name1</DisplayName>
      </Grantee>
      <Permission>FULL_CONTROL1</Permission>
    </Grant>

    <Grant>
      <Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser">
        <ID>370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c3</ID>
        <DisplayName>name2</DisplayName>
      </Grantee>
      <Permission>FULL_CONTROL2</Permission>
    </Grant>

    <Grant>
      <Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser">
        <ID>370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c4</ID>
        <DisplayName>name3</DisplayName>
      </Grantee>
      <Permission>FULL_CONTROL3</Permission>
    </Grant>
  </AccessControlList>
</AccessControlPolicy>
*/


const ast = {
  "$preamble": {
    "version": "1.0",
    "encoding": "UTF-8"
  },
  "$name": "AccessControlPolicy",
  "xmlns": "http://s3.amazonaws.com/doc/2006-03-01/",
  "$children": [
    {
      "$name": "Owner",
      "$children": [
        {
          "$name": "ID",
          "$children": [
            "370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2"
          ]
        },
        {
          "$name": "DisplayName",
          "$children": [
            "solumlibs"
          ]
        }
      ]
    },
    {
      "$name": "AccessControlList",
      "$children": [
        {
          "$name": "Grant",
          "$children": [
            {
              "$name": "Grantee",
              "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
              "xsi:type": "CanonicalUser",
              "$children": [
                {
                  "$name": "ID",
                  "$children": [
                    "370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2"
                  ]
                },
                {
                  "$name": "DisplayName",
                  "$children": [
                    "solumlibs"
                  ]
                }
              ]
            },
            {
              "$name": "Permission",
              "$children": [
                "FULL_CONTROL"
              ]
            }
          ]
        },
        {
          "$name": "Grant",
          "$children": [
            {
              "$name": "Grantee",
              "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
              "xsi:type": "CanonicalUser",
              "$children": [
                {
                  "$name": "ID",
                  "$children": [
                    "370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c3"
                  ]
                },
                {
                  "$name": "DisplayName",
                  "$children": [
                    "solumlibs2"
                  ]
                }
              ]
            },
            {
              "$name": "Permission",
              "$children": [
                "FULL_CONTROL"
              ]
            }
          ]
        },
        {
          "$name": "Grant",
          "$children": [
            {
              "$name": "Grantee",
              "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
              "xsi:type": "CanonicalUser",
              "$children": [
                {
                  "$name": "ID",
                  "$children": [
                    "370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c4"
                  ]
                },
                {
                  "$name": "DisplayName",
                  "$children": [
                    "solumlibs3"
                  ]
                }
              ]
            },
            {
              "$name": "Permission",
              "$children": [
                "FULL_CONTROL"
              ]
            }
          ]
        }
      ]
    }
  ]
}

/**
 * @name _astToObject
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
 * _astToObject(ast AST) -> data object
 * ```
 */
function _astToObject(ast) {
  const { $preamble, $name, $children, ...attributes } = ast

  const result = {}

  if ($children) {
    for (const child of $children) {
      if (typeof child == 'string') {
        if (result[$name]) {
          result[$name] = [result[$name], child]
        } else {
          result[$name] = child
        }
      } else if (child.$name) {
        if (result[$name]) {
          if (child.$name in result[$name]) {
            if (Array.isArray(result[$name][child.$name])) {
              result[$name][child.$name].push(_astToObject(child)[child.$name])
            } else {
              result[$name][child.$name] = [result[$name][child.$name], _astToObject(child)[child.$name]]
            }
          } else {
            result[$name] = Object.assign(result[$name], _astToObject(child))
          }
        } else {
          result[$name] = _astToObject(child)
        }
      } else {
        throw new TypeError('Invalid child')
      }
    }
  }

  return result
}

/**
 * @name awsXMLToJSON
 *
 * @docs
 * ```coffeescript [specscript]
 * awsXMLToJSON(xml string) -> data object
 * ```
 */
function awsXMLToJSON(xml) {
  // const ast = XML.parse(text)
  console.log(JSON.stringify(ast, null, 2))
  const result = _astToObject(ast)

  return result
}

// awsXMLToJSON()
console.log('result2', JSON.stringify(awsXMLToJSON(), null, 2))

module.exports = XML
