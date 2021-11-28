# @craftamap/esbuild-plugin-html [![npm](https://img.shields.io/npm/v/@craftamap/esbuild-plugin-html?color=green&style=flat-square)](https://www.npmjs.com/package/@craftamap/esbuild-plugin-html)

![Simple banner containing the name of the project in a html self-closing tag](.github/banner.png)

`@craftamap/esbuild-plugin-html` is a plugin to generate HTML files with [esbuild](https://esbuild.github.io/).
All specified entry points, and their related files (such as `.css`-files) are automatically injected into the HTML file.
`@craftamap/esbuild-plugin-html` is inspired by [jantimon/html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin).

## Requirements

This plugin was developed against `esbuild` v0.12.26, using node 16 (<= 14 should work, though).

## Installation

```bash
yarn add -D @craftamap/esbuild-plugin-html
# or
npm install --save-dev @craftamap/esbuild-plugin-html
```

## Usage

`@craftamap/esbuild-plugin-html` requires to have some options set in your esbuild script:

- `outdir` must be set.
- `metafile` must be set to `true`.

Your configuration file might looks like this:

```javascript
const esbuild = require('esbuild');
const { htmlPlugin } = require('@craftamap/esbuild-plugin-html');

const options = {
    entryPoints: ['src/index.jsx'],
    bundle: true,
    metafile: true, // needs to be set
    outdir: 'dist/', // needs to be set
    plugins: [
        htmlPlugin({
            files: [
                {
                    entryPoints: [
                        'src/index.jsx',
                    ],
                    filename: 'index.html',
                    htmlTemplate: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
                <div id="root">
                </div>
            </body>
            </html>
          `,
                },
            ]
        })
    ]
}

esbuild.build(options).catch(() => process.exit(1))
```

## Configuration

```
interface Configuration {
    files: HtmlFileConfiguration[],
}

interface HtmlFileConfiguration {
    filename: string, // Output filename, e.g. index.html
    entryPoints: string[], // Entry points to inject into the html, e.g. ['src/index.jsx']
    title?: string, // title to inject into the head, will not be set if not specified
    htmlTemplate?: string, // custom html document template string, a default template will be used if not specified
    scriptLoading?: 'blocking' | 'defer' | 'module', // Decide if the script tag will be inserted as blocking script tag, `defer=""` (default) or with `type="module"`
}
```

## Kudos: Other `*.html`-Plugins

There exist some other `*.html`-plugins for esbuild. Those work differently than `@craftamap/esbuild-plugin-html`, and might be a better fit for you:

- [@esbuilder/html](https://www.npmjs.com/package/@esbuilder/html) - loader-based approach (use `*.html`-file as entry point, and start subprocesses with `esbuild`)
- [@chialab/esbuild-plugin-html](https://www.npmjs.com/package/@chialab/esbuild-plugin-html) - loader-based approach
