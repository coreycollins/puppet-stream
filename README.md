# Nightcrawler

> Nightcrawler is a node library that makes it easy to stream scraping requests to Puppeteer using native NodeJS streams.

## Getting Started

### Install

```
  npm i nightcrawler
```

### Usage

```
const Nightcrawler = require('nightcrawler')

const main = async () => {
  let nc = new Nightcrawler()
  let q = nc
    .get('http://example.com')
    .waitFor('body')
    .groupBy('body > div')
    .select({ title: 'p' })

  let result = await nc.run(q)
  console.log(result)
  process.exit(0)
}

main()
```
