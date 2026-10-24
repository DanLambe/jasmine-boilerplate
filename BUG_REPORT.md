# Bug report for webdriverio/webdriverio

Paste each section below into the matching field of the
[🐛 Bug Report form](https://github.com/webdriverio/webdriverio/issues/new?template=bug_report.yml).

---

## Title

```
[🐛 Bug]: BiDi "Node with given id does not belong to the document" is not treated as a stale element, so isDisplayed/waitForDisplayed fail after a script navigation
```

## WebdriverIO Version

```
10.1.0
```

## Node.js Version

```
22.22.0
```

## Mode

WDIO Testrunner

## Which capabilities are you using?

```typescript
{
    browserName: 'chrome',
    'goog:chromeOptions': {
        args: ['headless', 'disable-gpu']
    }
}
```

## What happened?

Under the default v10 session type (WebDriver BiDi), an element command fails when it targets an element from the previous page while a navigation started by page script is still in flight. Examples of such navigations are `location.href = …`, a form submit, or a JS redirect. Chrome rejects the command with:

```
WebDriver Bidi command "script.callFunction" failed with error: unknown error - Node with given id does not belong to the document
```

WebdriverIO doesn't recognize that message as a stale element error, so it never re-finds the element on the new page and the error reaches the test. Under WebDriver Classic the same steps get `stale element reference`. WebdriverIO then re-finds the element and the test passes.

**Step by step (taken from the BiDi log below):**

1. `browser.execute((url) => { location.href = url }, '/two')`: under BiDi, `script.callFunction` returns right away (~15 ms), while the navigation is still pending. Under Classic, chromedriver's `executeScript` doesn't return until the new page has loaded.
2. `$('#loading-text').isDisplayed()` sends `script.callFunction` with the **old** node's `sharedId`.
3. Chrome holds that call until the new document commits (~3 s here, the test server's delay), then rejects it with `unknown error - Node with given id does not belong to the document`.
4. `invokeElementCommand` (`packages/webdriverio/src/middlewares.ts`) only re-finds the element when `isStaleElementToFindAgain(err)` is true. `isStaleElementError` (`packages/webdriverio/src/utils/index.ts`) has no match for this message, so the error is thrown unchanged.

**What the user sees:**

- `isDisplayed()` throws instead of returning `false`. The length of the navigation doesn't matter: 300 ms fails just as reliably as 3 s.
- `waitForDisplayed({ reverse: true, timeout: 1500 })` fails with the raw BiDi error after ~3 s, not with a timeout after 1500 ms. The wait can't time out before its first condition call returns, and by the time the call is rejected there's no time left to retry.
- If the navigation finishes before the wait's timeout, the wait passes by luck. The next attempt gets `SharedId "…" belongs to different document`, which *is* in the list, so the element is re-found. In real suites this looks like a flaky "wait for the spinner to disappear after submit" step that only fails when the server is slow.

**Results:**

| Session | `waitForDisplayed({ reverse: true })` | `isDisplayed()` |
|---|---|---|
| BiDi (v10 default) | fails 3/3 | throws 3/3 |
| BiDi, capability `webSocketUrl: false` | fails | throws |
| Classic, capability `'wdio:enforceWebDriverClassic': true` | passes 3/3 | returns `false` 3/3 |

Side note: in 10.1.0, `webSocketUrl: false` on its own doesn't opt out of BiDi. The log still shows `Connecting to webSocketUrl ws://…` and the tests still fail. Only `'wdio:enforceWebDriverClassic': true` gives a Classic session.

In our application we have also seen `Cannot find context with specified id` from the same kind of in-flight call. The repro below reliably produces only the first message.

**Root cause:** the BiDi messages that `isStaleElementError` currently matches are these (unchanged on `main` at 6b125a2):

```ts
// BIDI
err.message.includes('belongs to different document') ||
err.message.includes('no such node - The node with the reference') ||
/no such node - SharedId ".*" was not found/.test(err.message)
```

Chrome's "the call was sent to the old document" errors aren't in that list.

**Suggested fix:** add Chrome's two messages to `isStaleElementError`:

```ts
// BIDI, Chrome: a call that was sent to the old document while a navigation was in flight
err.message.includes('does not belong to the document') ||
err.message.includes('Cannot find context with specified id') ||
```

We tested this by adding the two checks to the built `isStaleElementError` in `node_modules/webdriverio`. Both repro tests then pass. The log shows the element re-found with `browsingContext.locateNodes` on the new page and `display: none` read from it. The risk looks low: if the re-find itself fails with an error that isn't stale, `invokeElementCommand` already rethrows the original error.

## What is your expected behavior?

The same as WebDriver Classic: WebdriverIO treats the error as a stale element and re-finds `#loading-text` on the new page. `isDisplayed()` then returns `false` and `waitForDisplayed({ reverse: true })` passes.

## How to reproduce the bug.

Minimal repro repo: https://github.com/DanLambe/jasmine-boilerplate/tree/bidi-stale-element-repro

It is [webdriverio/jasmine-boilerplate](https://github.com/webdriverio/jasmine-boilerplate) `main` (d62f666) with every `webdriverio` / `@wdio/*` package on 10.1.0, plus one spec and a Classic control config.

```sh
git clone -b bidi-stale-element-repro https://github.com/DanLambe/jasmine-boilerplate.git
cd jasmine-boilerplate
npm install
npm run repro:bidi      # 2 failing (default v10 BiDi session)
npm run repro:classic   # 2 passing (same spec, 'wdio:enforceWebDriverClassic': true)
```

`test/specs/bidi-stale.spec.ts` serves its own pages, so no external site is involved:

```ts
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

const pages: Record<string, string> = {
    // Visible spinner
    '/one': '<div id="loading-text">loading</div>',
    // Next page: spinner exists but is hidden
    '/two': '<div id="loading-text" style="display:none">loading</div><p>page two</p>'
}

describe('BiDi stale element after navigation', () => {
    let server: Server
    let base: string

    beforeAll(async () => {
        server = createServer((req, res) => {
            res.setHeader('content-type', 'text/html')
            // The second page responds slower than the wait timeout
            setTimeout(() => res.end(pages[req.url ?? ''] ?? ''), req.url === '/two' ? 3000 : 0)
        })
        await new Promise<void>((resolve) => server.listen(0, resolve))
        base = `http://localhost:${(server.address() as AddressInfo).port}`
    })

    afterAll(() => {
        server.closeAllConnections()
        server.close()
    })

    it('waits for the spinner to be hidden after a script navigation', async () => {
        await browser.url(`${base}/one`)
        const spinner = $('#loading-text')
        await expect(spinner).toBeDisplayed()

        // Navigate from page script, the way a form submit does
        await browser.execute((url) => { location.href = url }, `${base}/two`)

        await spinner.waitForDisplayed({ reverse: true, timeout: 1500, interval: 50 })
    })

    it('re-finds the element when isDisplayed() is called during a script navigation', async () => {
        await browser.url(`${base}/one`)
        const spinner = $('#loading-text')
        await expect(spinner).toBeDisplayed()

        await browser.execute((url) => { location.href = url }, `${base}/two`)

        // No wait involved: a single element command sent while the navigation is in flight
        expect(await spinner.isDisplayed()).toBe(false)
    })
})
```

**Tested on:**

- Windows 11, headless Chrome 156.0.8078.47, Node 24.20.0, WebdriverIO 10.1.0, this repo as-is: BiDi failed 3/3, Classic passed 3/3. BiDi with the suggested fix patched into `node_modules/webdriverio` passed 3/3.
- Linux, headless Chromium 141.0.7390.37, Node 22.22.0, WebdriverIO 10.1.0: BiDi failed 3/3, Classic passed 3/3. The test container couldn't download Chrome for Testing, so this run used a preinstalled chromedriver 147.0.7727.24 with `--disable-build-check`.
- macOS, Chrome 156, Node 24, WebdriverIO 10.1.0: a standalone script with the same steps failed 3/3 under BiDi and passed 3/3 under Classic.

## Relevant log output

```typescript
// npm run repro:bidi (spec reporter, driver stack trimmed)
» test/specs/bidi-stale.spec.ts
BiDi stale element after navigation
   ✖ waits for the spinner to be hidden after a script navigation
   ✖ re-finds the element when isDisplayed() is called during a script navigation

2 failing (6.4s)

1) BiDi stale element after navigation waits for the spinner to be hidden after a script navigation
Error: waitUntil condition failed with the following reason: WebDriver Bidi command "script.callFunction" failed with error: unknown error - Node with given id does not belong to the document
    at async UserContext.<anonymous> (test/specs/bidi-stale.spec.ts:38:9)
Caused by: Error: WebDriver Bidi command "script.callFunction" failed with error: unknown error - Node with given id does not belong to the document

2) BiDi stale element after navigation re-finds the element when isDisplayed() is called during a script navigation
Error: WebDriver Bidi command "script.callFunction" failed with error: unknown error - Node with given id does not belong to the document

// logs/bidi-stale.spec-0-0.log, test 1 (BiDi). Function bodies are labelled and the sharedId is shortened.
// No browsingContext.locateNodes after the error: the element is never re-found.
01:36:40.709Z BIDI COMMAND script.callFunction <location.href = url> ["http://localhost:35147/two"]
01:36:40.724Z BIDI COMMAND script.callFunction <checkVisibility> [{"sharedId":"f.4745….d.….e.2"}]
01:36:40.724Z BIDI COMMAND script.callFunction <getComputedStyle> [{"sharedId":"f.4745….d.….e.2"}]
01:36:43.745Z BIDI RESULT {"error":"unknown error","id":15,"message":"Node with given id does not belong to the document", ...}
01:36:43.844Z BIDI RESULT {"error":"unknown error","id":16,"message":"Node with given id does not belong to the document", ...}

// Same spec with 'wdio:enforceWebDriverClassic': true (function bodies labelled): stale element detected, element re-found, test passes
01:37:10.009Z COMMAND executeScript(<location.href = url>)
01:37:13.040Z RESULT null                                        // returns only after /two has loaded
01:37:13.042Z COMMAND executeScript(<checkVisibility>, <element>)
01:37:13.052Z WARN webdriver: Request encountered a stale element - terminating request
01:37:13.053Z COMMAND findElements("css selector", "#loading-text")
01:37:13.071Z RESULT false
01:37:13.074Z RESULT { value: 'none' }
```
