import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import * as fsPromises from 'fs/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as assert from 'assert'
import * as esbuild from 'esbuild'
const { htmlPlugin } = await import('../../lib/cjs/index.js')

describe('esbuild-plugin-html', () => {
    let savedDir
    beforeEach(async () => {
        savedDir = process.cwd()
        const testDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'esbuild-plugin-html_'))
        process.chdir(testDir)
    })
    afterEach(() => {
        process.chdir(savedDir)
    })

    const helper = async (/** @type {import('../../lib/cjs/index').HtmlFileConfiguration } */ htmlOptions, /** @type{import('esbuild').BuildOptions} */ esbuildOptions = {}) => {
        await fsPromises.mkdir('src/', { recursive: true })
        await fsPromises.writeFile('src/index.ts', '')

        await esbuild.build({
            // esbuild should default to the current cwd, but during import, so we need to specifcy a working directory here.
            absWorkingDir: process.cwd(),
            entryPoints: ['src/index.ts'],
            metafile: true,
            outdir: './out',
            plugins: [htmlPlugin({
                files: [
                    {
                        filename: 'index.html',
                        entryPoints: ['src/index.ts'],
                        ...htmlOptions
                    },
                ],
            })],
            ...esbuildOptions
        })


        assert.ok(fs.existsSync('out/index.html'))
        return await fsPromises.readFile('out/index.html', 'utf8')
    }

    it('creates html file with a script tag', async () => {
        const result = await helper({})

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`
        )
    })


    it('inserts a title into the html file', async () => {
        const result = await helper({ title: 'Hallo Welt!' })

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  <title>Hallo Welt!</title></head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`
        )
    })

    describe('scriptLoading', () => {
        it('blocking', async () => {
            const result = await helper({ scriptLoading: 'blocking' })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js"></script></body></html>`
            )
        })

        it('defer', async () => {
            const result = await helper({ scriptLoading: 'defer' })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`
            )
        })

        it('module', async () => {
            const result = await helper({ scriptLoading: 'module' })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" type="module"></script></body></html>`
            )
        })


        it('module, inline', async () => {
            const result = await helper({ inline: true, scriptLoading: 'module' })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script type="module"></script></body></html>`
            )
        })
    })


    it('creates html file containing the js inline', async () => {
        const result = await helper({ inline: true })

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script></script></body></html>`
        )
    })


    it('extraScripts', async () => {
        const result = await helper({ extraScripts: [{ src: 'https://example.com/what', attrs: { "type": "module" } }] })

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="https://example.com/what" type="module"></script><script src="index.js" defer=""></script></body></html>`
        )
    })


    it('creates a html file for a empty template', async () => {

        const result = await helper({
            htmlTemplate: '',
        })

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`
        )
    })



    it('lodash / define', async () => {

        const result = await helper({
            htmlTemplate: '<%- define.value %>',
            define: {
                value: 'hallo',
            }
        })

        assert.strictEqual(result, '<html><head></head><body>hallo<script src="index.js" defer=""></script></body></html>')
    })


    it('extra entrypoint', async () => {

        const m = mock.method(console, 'log', () => { })
        const result = await helper({
            entryPoints: ['src/index.ts', 'src/non-existent.ts'],
        })
        m.mock.restore()
        assert.ok(m.mock.calls.some((call) => call.arguments[0].includes('was requested, but not found')))

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`)
    })

    describe('favicon', () => {

        it('favicon', async () => {
            await fsPromises.mkdir('src/')
            await fsPromises.writeFile('src/foo.ico', '')
            const result = await helper({
                entryPoints: ['src/index.ts', 'src/non-existent.ts'],
                favicon: 'src/foo.ico',
            })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  <link rel="icon" href="/favicon.ico"></head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`)
        })


        it('favicon png', async () => {
            await fsPromises.mkdir('src/')
            await fsPromises.writeFile('src/bar.png', '')
            const result = await helper({
                entryPoints: ['src/index.ts', 'src/non-existent.ts'],
                favicon: 'src/bar.png',
            })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  <link rel="icon" href="/favicon.png"></head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`)
        })


        it('favicon no extension', async () => {
            await fsPromises.mkdir('src/')
            await fsPromises.writeFile('src/baz', '')
            const result = await helper({
                entryPoints: ['src/index.ts', 'src/non-existent.ts'],
                favicon: 'src/baz',
            })

            assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  <link rel="icon" href="/favicon"></head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`)
        })
    })

    describe('various esbuild option combinations', () => {
        it('works with metafile: true', async () => {
            await helper({}, {
                metafile: true
            })
        });
        it('works with metafile: undefined', async () => {
            const result = await helper({}, {
                metafile: undefined,
            })
            result.includes("out/index.js")
        });
        it('throws with metafile: false', async () => {
            await assert.rejects(async () => {
                await helper({}, {
                    metafile: false
                });
            }, /metafile is explictly disabled/)
        });
        it('throws with outdir: undefined', async () => {
            await assert.rejects(async () => {
                await helper({}, {
                    outdir: undefined,
                });
            }, /outdir must be set/)
        });
    })
})
