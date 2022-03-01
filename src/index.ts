import esbuild from 'esbuild'
import { promises as fs } from 'fs'
import path from 'path'
import { JSDOM } from 'jsdom'
import lodashTemplate from 'lodash.template'

interface Configuration {
    files: HtmlFileConfiguration[],
}

interface HtmlFileConfiguration {
    filename: string,
    entryPoints: string[],
    title?: string,
    htmlTemplate?: string,
    define?: Record<string, string>,
    scriptLoading?: 'blocking' | 'defer' | 'module',
    favicon?: string,
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

const REGEXES = {
    DIR_REGEX: '(?<dir>\\S+\\/?)',
    HASH_REGEX: '(?<hash>[A-Z2-7]{8})',
    NAME_REGEX: '(?<name>[^\\s\\/]+)',
}

function escapeRegExp(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}


export const htmlPlugin = (configuration: Configuration = { files: [], }): esbuild.Plugin => {
    let logInfo = false

    function collectEntrypoints(htmlFileConfiguration: HtmlFileConfiguration, metafile?: esbuild.Metafile) {
        const entryPoints = Object.entries(metafile?.outputs || {}).filter(([, value]) => {
            if (!value.entryPoint) {
                return false
            }
            return htmlFileConfiguration.entryPoints.includes(value.entryPoint)
        }).map(outputData => {
            // Flatten the output, instead of returning an array, let's return an object that contains the path of the output file as path
            return { path: outputData[0], ...outputData[1] }
        })
        return entryPoints
    }

    function findRelatedOutputFiles(entrypoint: { path: string }, metafile?: esbuild.Metafile, entryNames?: string) {
        const pathOfMatchedOutput = path.parse(entrypoint.path)

        // Search for all files that are "related" to the output (.css and map files, for example files, as assets are dealt with otherwise).
        if (entryNames) {
            // If entryNames is set, the related output files are more difficult to find, as the filename can also contain a hash.
            // The hash could also be part of the path, which could make it even more difficult
            // We therefore try to extract the dir, name and hash from the "main"-output, and try to find all files with
            // the same [name] and [dir].
            // This should always include the "main"-output, as well as all relatedOutputs
            const joinedPathOfMatch = path.join(pathOfMatchedOutput.dir, pathOfMatchedOutput.name)
            const findVariablesRegexString = escapeRegExp(entryNames)
                .replace('\\[hash\\]', REGEXES.HASH_REGEX)
                .replace('\\[name\\]', REGEXES.NAME_REGEX)
                .replace('\\[dir\\]', REGEXES.DIR_REGEX)
            const findVariablesRegex = new RegExp(findVariablesRegexString)
            const match = findVariablesRegex.exec(joinedPathOfMatch)

            const name = match?.groups?.['name']
            const dir = match?.groups?.['dir']

            return Object.entries(metafile?.outputs || {}).filter(([pathOfCurrentOutput,]) => {
                if (entryNames) {
                    // if a entryName is set, we need to parse the output filename, get the name and dir, 
                    // and find files that match the same criteria
                    const findFilesWithSameVariablesRegexString = escapeRegExp(entryNames.replace('[name]', name ?? '').replace('[dir]', dir ?? ''))
                        .replace('\\[hash\\]', REGEXES.HASH_REGEX)
                    const findFilesWithSameVariablesRegex = new RegExp(findFilesWithSameVariablesRegexString)
                    return findFilesWithSameVariablesRegex.test(pathOfCurrentOutput)
                }
            }).map(outputData => {
                // Flatten the output, instead of returning an array, let's return an object that contains the path of the output file as path
                return { path: outputData[0], ...outputData[1] }
            })
        } else {
            // If entryNames is not set, the related files are always next to the "main" output, and have the same filename, but the extension differs
            return Object.entries(metafile?.outputs || {}).filter(([key,]) => {
                return path.parse(key).name === pathOfMatchedOutput.name && path.parse(key).dir === pathOfMatchedOutput.dir
            }).map(outputData => {
                // Flatten the output, instead of returning an array, let's return an object that contains the path of the output file as path
                return { path: outputData[0], ...outputData[1] }
            })
        }
    }

    function renderTemplate(htmlFileConfiguration: HtmlFileConfiguration, htmlTemplate: string) {
        const templateContext = {
            define: htmlFileConfiguration.define,
        }

        const compiledTemplateFn = lodashTemplate(htmlTemplate)
        return compiledTemplateFn(templateContext)
    }

    // use the same joinWithPublicPath function as esbuild:
    //  https://github.com/evanw/esbuild/blob/a1ff9d144cdb8d50ea2fa79a1d11f43d5bd5e2d8/internal/bundler/bundler.go#L533
    function joinWithPublicPath(publicPath: string, relPath: string) {
        relPath = path.normalize(relPath)
        
        if (!publicPath) {
            publicPath = '.'
        }

        let slash = '/'
        if (publicPath.endsWith('/')) {
            slash = ''
        }
        return `${publicPath}${slash}${relPath}`
    }

    function injectFiles(dom: JSDOM, assets: { path: string }[], outDir: string, publicPath: string | undefined, htmlFileConfiguration: HtmlFileConfiguration) {
        const document = dom.window.document
        for (const outputFile of assets) {
            const filepath = outputFile.path

            let targetPath: string
            if (publicPath) {
                targetPath = joinWithPublicPath(publicPath, path.relative(outDir, filepath))
            } else {
                const htmlFileDirectory = path.join(outDir, htmlFileConfiguration.filename)
                targetPath = path.relative(path.dirname(htmlFileDirectory), filepath)
            }
            const ext = path.parse(filepath).ext
            if (ext === '.js') {
                const scriptTag = document.createElement('script')
                scriptTag.setAttribute('src', targetPath)

                if (htmlFileConfiguration.scriptLoading === 'module') {
                    // If module, add type="module"
                    scriptTag.setAttribute('type', 'module')
                } else if (!htmlFileConfiguration.scriptLoading || htmlFileConfiguration.scriptLoading === 'defer') {
                    // if scriptLoading is unset, or defer, use defer
                    scriptTag.setAttribute('defer', '')
                }

                document.body.append(scriptTag)
            } else if (ext === '.css') {
                const linkTag = document.createElement('link')
                linkTag.setAttribute('rel', 'stylesheet')
                linkTag.setAttribute('href', targetPath)
                document.head.appendChild(linkTag)
            } else {
                logInfo && console.log(`Warning: found file ${targetPath}, but it was neither .js nor .css`)
            }
        }
    }

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

                        const relatedOutputFiles = findRelatedOutputFiles(entrypoint, result.metafile, build.initialOptions.entryNames)

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

                    injectFiles(dom, collectedOutputFiles, outdir, publicPath, htmlFileConfiguration)

                    const out = path.join(outdir, htmlFileConfiguration.filename)
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
