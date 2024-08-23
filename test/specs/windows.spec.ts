import WindowPage from '../pageobjects/window.page'
import NewWindowPage from '../pageobjects/newWindow.page'

describe('windows', () => {
    it('opens, navigates, and asserts new window is in focus with context switching', async () => {
        await WindowPage.open()
        await WindowPage.clickClickHereButton()
        await browser.switchWindow('New Window')
        await expect(NewWindowPage.newWindowText).toBeDisplayed()
    })

    it('opens, navigates, and asserts new window is in focus without switching context', async () => {
        await WindowPage.open()
        await WindowPage.clickClickHereButton()
        await expect(NewWindowPage.newWindowText).toBeDisplayed()
    })
})
