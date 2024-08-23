import Page from './page.js'

class WindowPage extends Page {
    /**
     * define elements
     */
    get clickHereButton () { return $('a=Click Here') }
    get windowsExampleButton () { return $('a=Multiple Windows') }

    open () {
        return super.open('windows')
    }
    
    async clickClickHereButton() {
        await this.clickHereButton.waitForDisplayed()
        await this.clickHereButton.click()
    }
}

export default new WindowPage()
