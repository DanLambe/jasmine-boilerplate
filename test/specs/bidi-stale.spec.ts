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
