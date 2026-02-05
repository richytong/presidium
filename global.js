const presidium = require('.')

for (const className in presidium) {
  globalThis[className] = presidium[className]
}
