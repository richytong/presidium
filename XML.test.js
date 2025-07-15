const assert = require('assert')
const XML = require('./XML')

describe('XML', () => {
  it('Parses the XML optional preamble', async () => {
    assert.deepEqual(
      XML.parse('<?xml version="1.0" encoding="UTF-8"?>'),
      { $preamble: { version: '1.0', encoding: 'UTF-8' } }
    )
  })

  it('Parses XML tags 1', async () => {
    assert.deepEqual(
      XML.parse(`
<Test a="1">
  <Sub>Content</Sub>
</Test>
      `),
      {
        $name: 'Test',
        a: '1',
        $children: [
          {
            $name: 'Sub',
            $children: ['Content']
          }
        ]
      }
    )

  })

  it('Parses XML tags 2', async () => {
    assert.deepEqual(
      XML.parse(
        '<D><Sub c="3"> <Sub>a</Sub> Content</Sub>  <Sub2 d="/////">    <Sub3 e="nested"> </Sub3>  </Sub2> </D>'
      ),
      {
        $name: 'D',
        $children: [
          {
            $name: 'Sub',
            c: '3',
            $children: [
              {
                $name: 'Sub',
                $children: ['a']
              },
              'Content'
            ]
          },
          {
            $name: 'Sub2',
            d: '/////',
            $children: [
              {
                $name: 'Sub3',
                e: 'nested',
                $children: []
              }
            ]
          }
        ]
      }
    )
  })

  it('Parses XML tags 3', async () => {
    assert.deepEqual(
      XML.parse(
        `
<?xml version="1.0" encoding="UTF-8"?>
<Root>
  <LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>
  <Test a="1" b="abc"><Sub c="3">Content</Sub>
    <Sub2 d="/////">
      <Sub3 e="nested"></Sub3>
    </Sub2>
  </Test>
</Root>
        `.trim()
      ),
      {
        $preamble: { version: '1.0', encoding: 'UTF-8' },
        $name: 'Root',
        $children: [
          {
            $name: 'LocationConstraint',
            xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/',
            $children: []
          },
          {
            $name: 'Test',
            a: '1',
            b: 'abc',
            $children: [
              {
                $name: 'Sub',
                c: '3',
                $children: ['Content']
              },
              {
                $name: 'Sub2',
                d: '/////',
                $children: [
                  {
                    $name: 'Sub3',
                    e: 'nested',
                    $children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    )

  })

  it('Throws SyntaxError for malformed tag', async () => {
    assert.throws(
      () => XML.parse('asdf'),
      new SyntaxError('Malformed tag')
    )
  })

  it('Throws SyntaxError for unquoted tag', async () => {
    assert.throws(
      () => XML.parse('<Test a=1 />'),
      new SyntaxError('Expected quote for attribute value')
    )
  })

  it('Throws SyntaxError for mismatched tag', async () => {
    assert.throws(
      () => XML.parse('<Test></Test2>'),
      new SyntaxError('Mismatched </Test2> – expected </Test>')
    )
  })

  it('Throws SyntaxError for extra content after root tag', async () => {
    assert.throws(
      () => XML.parse('<Test></Test>extra'),
      new SyntaxError('Extra content')
    )
  })

})
