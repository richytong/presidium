const assert = require('assert')
const XML = require('./XML')

describe('XML', () => {
  it('Parses the XML optional preamble', async () => {
    assert.deepEqual(
      XML.parse('<?xml version="1.0" encoding="UTF-8"?>', { ast: true }),
      { $preamble: { version: '1.0', encoding: 'UTF-8' } }
    )
  })

  it('Parses XML tags 1', async () => {
    assert.deepEqual(
      XML.parse(`
<Test a="1">
  <Sub>Content</Sub>
</Test>
      `, { ast: true }),
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
        '<D><Sub c="3"> <Sub>a</Sub> Content</Sub>  <Sub2 d="/////">    <Sub3 e="nested"> </Sub3>  </Sub2> </D>',
        { ast: true }
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
        `.trim(),
        { ast: true }
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

  it('Parses XML tags 4', async () => {
    const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2</ID>
    <DisplayName>name1</DisplayName>
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
    `.trim()

    const data = XML.parse(xml)

    assert.deepEqual(data, {
      AccessControlPolicy: {
        xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/',
        Owner: {
          ID: '370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2',
          DisplayName: 'name1'
        },

        AccessControlList: {
          Grant: [
            {
              Grantee: {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xsi:type': 'CanonicalUser',
                ID: '370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c2',
                DisplayName: 'name1'
              },
              Permission: 'FULL_CONTROL1'
            },

            {
              Grantee: {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xsi:type': 'CanonicalUser',
                ID: '370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c3',
                DisplayName: 'name2'
              },
              Permission: 'FULL_CONTROL2'
            },

            {
              Grantee: {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xsi:type': 'CanonicalUser',
                ID: '370c43724c254f9494e4e7b36be4b774e1be6e75c7c6060e79aee71c6641a5c4',
                DisplayName: 'name3'
              },
              Permission: 'FULL_CONTROL3'
            }
          ]
        }
      }
    })
  })

  it('Parses XML tags 5', async () => {
    const xml = `
<Test>test</Test>
    `.trim()
    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: 'test' })
  })

  it('Parses XML tags 6', async () => {
    const xml = `
<Test>
  <Test2>a</Test2>
  <Test2>b</Test2>
  <Test2>c</Test2>
</Test>
    `.trim()
    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { Test2: ['a', 'b', 'c'] } })
  })

  it('Parses XML tags 7', async () => {
    const xml = `
<Test>
  <Test2>a <Test3></Test3></Test2>
</Test>
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { Test2: ['a', { Test3: '' }] } })
  })

  it('Parses XML tags 8', async () => {
    const xml = `
<Test>
  <Test2>a <Test3></Test3> b </Test2>
</Test>
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { Test2: ['a', { Test3: '' }, 'b'] } })
  })

  it('Parses XML tags 9', async () => {
    const xml = `
<Test></Test>
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: '' })
  })

  it('Parses XML tags 10', async () => {
    const xml = `
<Test a="1"></Test>
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { a: '1' } })
  })

  it('Parses XML tags 11', async () => {
    const xml = `
<Test>
  <Test2><Test3></Test3> b </Test2>
</Test>
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { Test2: [{ Test3: '' }, 'b'] } })
  })

  it('Parses XML tags 12', async () => {
    const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, {
      LocationConstraint: { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' }
    })
  })

  it('Parses XML tags 13', async () => {
    const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-west-1</LocationConstraint>
    `.trim()

    const data = XML.parse(xml)
    const region = new String('us-west-1')
    region.xmlns = 'http://s3.amazonaws.com/doc/2006-03-01/'
    assert.deepEqual(data, {
      LocationConstraint: region
    })
  })

  it('Parses XML tags 14', async () => {
    const xml = `
<Test a="1" />
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { a: '1' } })
  })

  it.only('Parses XML tags 15', async () => {
    const xml = `
<meta a="1">
    `.trim()

    const data = XML.parse(xml)
    assert.deepEqual(data, { Test: { a: '1' } })
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
