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
        console.log(testDir)
        process.chdir(testDir)
    })
    afterEach(() => {
        process.chdir(savedDir)
    })
    it('creates a html file for a simple entry file', async () => {
        await fsPromises.mkdir('src/')
        await fsPromises.writeFile('src/index.ts', '')

        // esbuild should default to the current cwd, but during import. using dynamic imports, we can avoid this.
        const esbuild = await import('esbuild')
        await esbuild.build({
            entryPoints: ['src/index.ts'],
            metafile: true,
            outdir: './out',
            logLevel: 'info',
            plugins: [htmlPlugin({
                files: [
                    {
                        filename: 'index.html',
                        entryPoints: ['src/index.ts'],
                    },
                ]
            })]
        })

        assert.ok(fs.existsSync('out/index.html'))
        assert.strictEqual(await fsPromises.readFile('out/index.html', 'utf8'), `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
  </head>
  <body>
  

<script src="index.js" defer=""></script></body></html>`
        )
    })
})
