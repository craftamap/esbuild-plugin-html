import lodashTemplate from 'lodash.template'
import type { HtmlFileConfiguration } from '.'
import type esbuild from 'esbuild'
import path from 'path'
import { JSDOM } from 'jsdom'

const REGEXES = {
    DIR_REGEX: '(?<dir>\\S+\\/?)',
    HASH_REGEX: '(?<hash>[A-Z2-7]{8})',
    NAME_REGEX: '(?<name>[^\\s\\/]+)',
}

// This function joins a path, and in case of windows, it converts backward slashes ('\') forward slashes ('/').
export function posixJoin(...paths: string[]): string {
    const joined = path.join(...paths)
    if (path.sep === '/') {
        return joined
    }
    return joined.split(path.sep).join(path.posix.sep)
}

function escapeRegExp(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

export function collectEntrypoints(htmlFileConfiguration: HtmlFileConfiguration, metafile?: esbuild.Metafile) {
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

export function findRelatedOutputFiles(entrypoint: { path: string }, metafile?: esbuild.Metafile, entryNames?: string) {
    const pathOfMatchedOutput = path.parse(entrypoint.path)

    // Search for all files that are "related" to the output (.css and map files, for example files, as assets are dealt with otherwise).
    if (entryNames) {
        // If entryNames is set, the related output files are more difficult to find, as the filename can also contain a hash.
        // The hash could also be part of the path, which could make it even more difficult
        // We therefore try to extract the dir, name and hash from the "main"-output, and try to find all files with
        // the same [name] and [dir].
        // This should always include the "main"-output, as well as all relatedOutputs
        const joinedPathOfMatch = posixJoin(pathOfMatchedOutput.dir, pathOfMatchedOutput.name)
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

export function renderTemplate(htmlFileConfiguration: HtmlFileConfiguration, htmlTemplate: string) {
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

export function injectFiles(dom: JSDOM, assets: { path: string }[], outDir: string, publicPath: string | undefined, htmlFileConfiguration: HtmlFileConfiguration, logInfo: boolean) {
    const document = dom.window.document
    for (const outputFile of assets) {
        const filepath = outputFile.path

        let targetPath: string
        if (publicPath) {
            targetPath = joinWithPublicPath(publicPath, path.relative(outDir, filepath))
        } else {
            const htmlFileDirectory = posixJoin(outDir, htmlFileConfiguration.filename)
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
