Jasmine Boilerplate ![CI](https://github.com/webdriverio/jasmine-boilerplate/workflows/CI/badge.svg?event=push)
===================

Boilerplate project to run WebdriverIO tests with Jasmine using latest ES2016 features and the page objects pattern.

## WebdriverIO v10 BiDi stale element repro

This branch is `webdriverio/jasmine-boilerplate` `main` with every WebdriverIO package on 10.1.0, plus [`test/specs/bidi-stale.spec.ts`](test/specs/bidi-stale.spec.ts). Under the default BiDi session, an element command sent while a script-driven navigation is in flight fails with `Node with given id does not belong to the document`. WebdriverIO doesn't treat that as a stale element, so it never re-finds the element. See [BUG_REPORT.md](BUG_REPORT.md).

```sh
npm install
npm run repro:bidi      # fails: default v10 BiDi session
npm run repro:classic   # passes: same spec with 'wdio:enforceWebDriverClassic': true
```

## Quick Start

Choose one of the following options:

1. Download the latest stable release [here](https://github.com/webdriverio/jasmine-boilerplate/archive/master.zip) or clone the git repo — `git clone https://github.com/webdriverio/jasmine-boilerplate.git`

2. Then copy the files to your project directory (all files in `/test` and the `wdio.*.conf.js`)

3. Merge project dev dependencies with your projects dev dependencies in your `package.json`


## Features

- super simple setup
- Page Object pattern used
- ESNext ready
- Integration with [Sauce Labs](https://saucelabs.com/)
- Example using [GitHub Actions](https://github.com/features/actions)
