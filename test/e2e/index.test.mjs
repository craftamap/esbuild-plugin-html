import { describe, it, beforeEach, afterEach } from 'node:test'
import { htmlPlugin } from '../../lib/cjs/index.js'
import * as fsPromises from 'fs/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as assert from 'assert'

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

    const helper = async (htmlOptions) => {
        await fsPromises.mkdir('src/')
        await fsPromises.writeFile('src/index.ts', '')

        // esbuild should default to the current cwd, but during import. using dynamic imports, we can avoid this.
        const esbuild = await import('esbuild')
        await esbuild.build({
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
                ]
            })]
        })


        assert.ok(fs.existsSync('out/index.html'))
        return await fsPromises.readFile('out/index.html', 'utf8')

    }

    it('creates a html file for a simple entry file', async () => {

        const result = await helper({})

        assert.strictEqual(result, `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`
        )
    })


    it('creates a html file for a empty entry file', async () => {

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



    it('quick lodash test', async () => {

        const result = await helper({
            htmlTemplate: '<%- define.value %>',
            define: {
                value: 'hallo',
            }
        })

        assert.strictEqual(result, '<html><head></head><body>hallo<script src="index.js" defer=""></script></body></html>')
    })
})
