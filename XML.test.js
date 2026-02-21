const Test = require('thunk-test')
const assert = require('assert')
const XML = require('./XML')

const test = new Test('XML', XML.parse)

test.case(
  '<?xml version="1.0" encoding="UTF-8"?>',
  { ast: true },
  { $preamble: { version: '1.0', encoding: 'UTF-8' } }
)

test.case(
  `
<Test a="1">
  <Sub>Content</Sub>
</Test>
  `,
  { ast: true },
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

test.case(
  '<D><Sub c="3"> <Sub>a</Sub> Content</Sub>  <Sub2 d="/////">    <Sub3 e="nested"> </Sub3>  </Sub2> </D>',
  { ast: true },
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

test.case(
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
  { ast: true },
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

test.case(
  `
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
  `,
  {
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
  }
)

test.case('<Test>test</Test>', { Test: 'test' })

test.case(
  `
<Test>
  <Test2>a</Test2>
  <Test2>b</Test2>
  <Test2>c</Test2>
</Test>
  `,
  { Test: { Test2: ['a', 'b', 'c'] } }
)

test.case(
  `
<Test>
  <Test2>a <Test3></Test3></Test2>
</Test>
  `,
  { Test: { Test2: ['a', { Test3: '' }] } }
)

test.case(
  `
<Test>
  <Test2>a <Test3></Test3> b </Test2>
</Test>
  `,
  { Test: { Test2: ['a', { Test3: '' }, 'b'] } }
)

test.case('<Test></Test>', { Test: '' })
test.case('<Test a="1"></Test>', { Test: { a: '1' } })

test.case(
  `
<Test>
  <Test2><Test3></Test3> b </Test2>
</Test>
  `,
  { Test: { Test2: [{ Test3: '' }, 'b'] } }
)

test.case(
  `
<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>
  `,
  { LocationConstraint: { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' } }
)

{
  const region = new String('us-west-1')
  region.xmlns = 'http://s3.amazonaws.com/doc/2006-03-01/'

  test.case(
    `
<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-west-1</LocationConstraint>
    `,
    data => {
      assert.deepEqual(data, {
        LocationConstraint: region
      })
    }
  )
}

test.case('<Test a="1" />', { Test: { a: '1' } })
test.throws('asdf', new SyntaxError('Malformed tag'))
test.throws('<Test a=1 />', new SyntaxError('Expected quote for attribute value'))
test.throws('<Test></Test2>', new SyntaxError('Mismatched </Test2> – expected </Test>'))
test.throws('<Test></Test>extra', new SyntaxError('Extra content'))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
