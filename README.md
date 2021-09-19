# esbuild-html-plugin

`esbuild-html-plugin` is a plugin to generate HTML files with [esbuild](https://esbuild.github.io/).
All specified entry points, and their related files (such as `.css`-files) are automatically injected into the HTML file.
`esbuild-html-plugin` is inspired by [jantimon/html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin).

## Requirements

This plugin was developed against `esbuild` v0.12.26, using node 16 (<= 14 should work, though).

## Installation

```bash
yarn add -D esbuild-html-plugin
# or
npm install --save-dev html-webpack-plugin
```

## Usage

`esbuild-html-plugin` requires to have some options set in your esbuild script:

- `outdir` must be set.
- `metafile` must be set to `true`.

Your configuration file might looks like this:

```javascript
const esbuild = require('esbuild');
const { htmlPlugin } = require('../esbuild-html-plugin');

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
    htmlTemplate?: string, // custom html document template string
}
```
