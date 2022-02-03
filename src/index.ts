import esbuild from 'esbuild'
import { promises as fs } from 'fs'
import path from 'path'
import { JSDOM } from 'jsdom'
import { collectEntrypoints, findRelatedOutputFiles, injectFiles, posixJoin, renderTemplate } from './helpers'

export interface Configuration {
    files: HtmlFileConfiguration[],
}

export interface HtmlFileConfiguration {
    filename: string,
    entryPoints: string[],
    title?: string,
    htmlTemplate?: string,
    define?: Record<string, string>,
    scriptLoading?: 'blocking' | 'defer' | 'module',
    favicon?: string,
    findRelatedOutputFiles?: boolean,
}

const defaultHtmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
  </body>
</html>
`


export const htmlPlugin = (configuration: Configuration = { files: [], }): esbuild.Plugin => {
    configuration.files = configuration.files.map((htmlFileConfiguration: HtmlFileConfiguration) => {
        return Object.assign({}, { 'findRelatedOutputFiles': true }, htmlFileConfiguration) // Set default values
    })

    let logInfo = false

    return {
        name: 'esbuild-html-plugin',
        setup(build) {
            build.onStart(() => {
                if (!build.initialOptions.metafile) {
                    throw new Error('metafile is not enabled')
                }
                if (!build.initialOptions.outdir) {
                    throw new Error('outdir must be set')
                }
            })
            build.onEnd(async result => {
                const startTime = Date.now()
                if (build.initialOptions.logLevel == 'debug' || build.initialOptions.logLevel == 'info') {
                    logInfo = true
                }
                logInfo && console.log()


                for (const htmlFileConfiguration of configuration.files) {
                    // First, search for outputs with the configured entryPoints
                    const collectedEntrypoints = collectEntrypoints(htmlFileConfiguration, result.metafile)

                    // All output files relevant for this html file
                    let collectedOutputFiles: (esbuild.Metafile['outputs'][string] & { path: string })[] = []

                    for (const entrypoint of collectedEntrypoints) {
                        if (!entrypoint) {
                            throw new Error(`Found no match for ${htmlFileConfiguration.entryPoints}`)
                        }
                        let relatedOutputFiles
                        if (htmlFileConfiguration.findRelatedOutputFiles) {
                            relatedOutputFiles = findRelatedOutputFiles(entrypoint, result.metafile, build.initialOptions.entryNames)
                        } else {
                            relatedOutputFiles = [entrypoint]
                        }

                        collectedOutputFiles = [...collectedOutputFiles, ...relatedOutputFiles]
                    }
                    // Note: we can safely disable this rule here, as we already asserted this in setup.onStart
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const outdir = build.initialOptions.outdir!

                    const publicPath = build.initialOptions.publicPath

                    const htmlTemplate = htmlFileConfiguration.htmlTemplate || defaultHtmlTemplate

                    const templatingResult = renderTemplate(htmlFileConfiguration, htmlTemplate)

                    // Next, we insert the found files into the htmlTemplate - if no htmlTemplate was specified, we default to a basic one.
                    const dom = new JSDOM(templatingResult)
                    const document = dom.window.document

                    if (htmlFileConfiguration.title) {
                        // If a title was given, we pass the title as well
                        document.title = htmlFileConfiguration.title
                    }

                    if (htmlFileConfiguration.favicon) {
                        // Injects a favicon if present
                        await fs.copyFile(htmlFileConfiguration.favicon, `${outdir}/favicon.ico`)

                        const linkTag = document.createElement('link')
                        linkTag.setAttribute('rel', 'icon')
                        linkTag.setAttribute('href', '/favicon.ico')
                        document.head.appendChild(linkTag)
                    }

                    injectFiles(dom, collectedOutputFiles, outdir, publicPath, htmlFileConfiguration, logInfo)

                    const out = posixJoin(outdir, htmlFileConfiguration.filename)
                    await fs.mkdir(path.dirname(out), {
                        recursive: true,
                    })
                    await fs.writeFile(out, dom.serialize())
                    const stat = await fs.stat(out)
                    logInfo && console.log(`  ${out} - ${stat.size}`)
                }
                logInfo && console.log(`  HTML Plugin Done in ${Date.now() - startTime}ms`)
            })
        }
    }
}
