const fs = require("fs")
const assert = require("assert")
const package = require("./package")

async function moduleTest() {
  try {
    await fs.promises.rm(`${__dirname}/tmp`, { recursive: true })
  } catch {
  }

  assert(package.files.includes("index.js"))
  assert(package.files.includes("global.js"))

  await fs.promises.mkdir(`${__dirname}/tmp`)
  await fs.promises.mkdir(`${__dirname}/tmp/internal`)
  await fs.promises.writeFile(
    `${__dirname}/tmp/package.json`,
    await fs.promises.readFile(`${__dirname}/package.json`)
  )
  for (const filename of package.files) {
    await fs.promises.writeFile(
      `${__dirname}/tmp/${filename}`,
      await fs.promises.readFile(`${__dirname}/${filename}`)
    )
  }
  for (const filename of package.files) {
    require(`./tmp/${filename}`)
  }
  await fs.promises.rm(`${__dirname}/tmp`, { recursive: true })
  console.log("Success")
}

moduleTest()
