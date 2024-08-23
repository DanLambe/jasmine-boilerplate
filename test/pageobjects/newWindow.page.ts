import Page from './page.js'

class NewWindowPage extends Page {
    /**
     * define elements
     */
    get newWindowText () { return $('h3=New Window') }

    open () {
        return super.open('windows/new')
    }
    
}

export default new NewWindowPage()
