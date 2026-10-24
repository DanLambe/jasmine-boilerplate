import { config as sharedConfig } from './wdio.shared.conf.js'

/**
 * Control run for the BiDi stale element repro: the same local Chrome
 * capability as wdio.local.conf.ts, forced onto a WebDriver Classic session.
 */
export const config: WebdriverIO.Config = {
    ...sharedConfig,
    ...{
        capabilities: [{
            browserName: 'chrome',
            'wdio:enforceWebDriverClassic': true,
            'goog:chromeOptions': {
                args: ['headless', 'disable-gpu']
            }
        }]
    }
}
