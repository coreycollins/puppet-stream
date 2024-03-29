const test = require('ava')
const path = require('path')

const TestServer = require('../utils/testServer')
const { Query, $ } = require('../lib/query')
const Browser = require('../lib/browser')

const { TimeoutError } = require('puppeteer/Errors')

test.before(async t => {
  // This runs before all tests
  const server = new TestServer(path.join(__dirname, 'htmls'), 9000)
  await new Promise(x => server._server.once('listening', x))

  t.context.server = server
  t.context.browser = new Browser()
})

test.after.always('guaranteed cleanup', async t => {
  // This will always run, regardless of earlier failures
  await t.context.browser.close()
  await t.context.server.stop()
})

test.serial('should throw error if undefined or null url is used', async t => {
  await t.throwsAsync(
    async () => {
      await Query.go()
    },
    { message: 'invalid query' }
  )
})

test.serial('should return an object with results', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`
  let resp = await Query.go(url)
    .select({ title: $('body > div > p') })
    ._run(browser)

  t.truthy(resp.results)
})

test.serial('should send context with results', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`
  let q = Query.go(url).select({ title: $('body > div > p') })
  q.context = { foo: 'bar' }
  let resp = await q._run(browser)

  t.truthy(resp.results)
  t.deepEqual(resp._context, { url: 'http://localhost:9000/example.html', foo: 'bar' })
})

test.serial('should throw error if extract function doesnt return result', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  await t.throwsAsync(
    async () => {
      await Query.go(url)._run(browser)
    },
    { message: 'query did not return any results. Did you forget a select?' }
  )
})

test.serial('should throw error if context isnt an object', async t => {
  await t.throws(
    () => {
      let q = new Query()
      q.context = 'notanobject'
    },
    { message: 'context must be an object' }
  )
})

test.serial('should throw error if blank request', async t => {
  let browser = await t.context.browser.get()
  await t.throwsAsync(
    async () => {
      await Query.go('about:blank')._run(browser)
    },
    { message: 'blank page' }
  )
})

test.serial('should throw error if bad request', async t => {
  let browser = await t.context.browser.get()
  await t.throwsAsync(
    async () => {
      await Query.go('https://httpstat.us/404')._run(browser)
    },
    { message: 'Not Found', code: 404 }
  )
})

test.serial('should wait for a selector', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/delay.html`

  let resp = await Query.go(url)
    .waitFor($('#demo > ul > li'))
    .select({ title: $('#demo > ul > li') })
    ._run(browser)

  t.deepEqual(resp.results, [{ title: 'DYNAMIC THING' }])
})

test.serial('should groupBy elements', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  let resp = await Query.go(url)
    .groupBy($('body > div'))
    .select({ title: $('p') })
    ._run(browser)

  t.deepEqual(resp.results, [{ title: 'Test' }, { title: 'Foo' }])
})

test.serial('should chain functions together', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  let resp = await Query.go(url)
    .waitFor($('body'))
    .groupBy($('body > div'))
    .select({ title: $('p') })
    ._run(browser)

  t.deepEqual(resp.results, [{ title: 'Test' }, { title: 'Foo' }])
})

test.serial('should timeout after 10ms while waiting for an element', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  await t.throwsAsync(async () => {
    await Query.go(url)
      .waitFor($('body > doesnotexists'), 10)
      ._run(browser)
  }, TimeoutError)
})

test.serial('should expect only one select function', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  await t.throwsAsync(async () => {
    await Query.go(url)
      .select({ title: $('body > div > p') })
      .select({ title: $('body > div > p') })
      ._run(browser)
  }, 'Select can only take a path collection')
})

test.serial('should goto multiple pages', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/delay.html`

  let resp = await Query.go(url)
    .go(`${t.context.server.host}/example.html`)
    .select({ title: $('body > div > p') })
    ._run(browser)

  t.deepEqual(resp.results, [{ title: 'Test' }])
})

test.serial('should preform a custom action', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  let addEle = async ({ page, results } = {}) => {
    await page.evaluate(() => {
      var node = document.createElement('SPAN') // Create a <li> node
      var textnode = document.createTextNode('Foo') // Create a text node
      node.appendChild(textnode)
      σ.$('body > div').appendChild(node)
    })
    return { page, results }
  }

  let resp = await Query.go(url)
    .eval(addEle)
    .select({ title: $('body > div > span') })
    ._run(browser)

  t.deepEqual(resp.results, [{ title: 'Foo' }])
})

test.serial('should get single result from a complex webpage', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/gmap_us_single.html`

  let resp = await Query.go(url)
    .select({
      name: $('div.section-hero-header-title > h1'),
      address: $(
        '#pane > div.widget-pane.widget-pane-content-disabled.widget-pane-offscreen > div.widget-pane-content.scrollable-y > div > div > div:nth-child(5) > div > span:nth-child(3) > span.section-info-text > span:nth-child(1) > span'
      ),
      phone: $(
        '#pane > div.widget-pane.widget-pane-content-disabled.widget-pane-offscreen > div.widget-pane-content.scrollable-y > div > div > div:nth-child(7) > div > span:nth-child(3) > span.section-info-text > button'
      ),
      url: $('a[data-attribution-url]')
    })
    ._run(browser)

  t.deepEqual(resp.results, [
    {
      name: "Boudreaux's Louisiana Seafood & Steaks",
      address: '224 N 4th St, St Joseph, MO 64501',
      phone: '(816) 387-9911',
      url: 'boudreauxstjoe.com'
    }
  ])
})

test.serial('should get text from attr', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  let resp = await Query.go(url)
    .select({ dataAttr: $('body > div > p', 'data-attr') })
    ._run(browser)

  t.deepEqual(resp.results, [{ dataAttr: 'datainhere' }])
})

test.serial('should passthrough values that are not selectors', async t => {
  let browser = await t.context.browser.get()
  let url = `${t.context.server.host}/example.html`

  let resp = await Query.go(url)
    .select({ title: $('body > div > p'), foo: 'bar' })
    ._run(browser)

  t.deepEqual(resp.results, [{ title: 'Test', foo: 'bar' }])
})
