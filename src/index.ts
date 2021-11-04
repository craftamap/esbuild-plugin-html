import esbuild from "esbuild";
import { promises as fs } from "fs";
import path from "path";
import { JSDOM } from "jsdom";

interface Configuration {
    files: HtmlFileConfiguration[],
}

interface HtmlFileConfiguration {
    filename: string,
    entryPoints: string[],
    title?: string,
    htmlTemplate?: string,
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
`;

const REGEXES = {
    DIR_REGEX: '(?<dir>\\S+\\\/?)',
    HASH_REGEX: '(?<hash>[A-Z2-7]{8})',
    NAME_REGEX: '(?<name>[^\\s\\/]+)',
};

function escapeRegExp(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export const htmlPlugin = (configuration: Configuration = { files: [], }): esbuild.Plugin => {
    return {
        name: 'esbuild-html-plugin',
        setup(build) {
            build.onStart(() => {
                if (!build.initialOptions.metafile) {
                    throw new Error("metafile is not enabled");
                }
                if (!build.initialOptions.outdir) {
                    throw new Error("outdir must be set");
                }
            })
            build.onEnd(async result => {
                const startTime = Date.now()
                let logInfo = false;
                if (build.initialOptions.logLevel == 'debug' || build.initialOptions.logLevel == 'info') {
                    logInfo = true;
                }
                logInfo && console.log()

                const outdir = build.initialOptions.outdir!;

                for (const htmlFileConfiguration of configuration.files) {
                    // First, search for outputs with the configured entryPoints
                    const matchedOutputs = Object.entries(result.metafile?.outputs || {}).filter(([_, value]) => {
                        return htmlFileConfiguration.entryPoints.includes(value.entryPoint!)
                    });

                    let relevantOutputs: [string, esbuild.Metafile['outputs'][string]][] = [];

                    for (const matchedOutput of matchedOutputs) {
                        if (!matchedOutputs) {
                            throw new Error(`Found no match for ${htmlFileConfiguration.entryPoints}`)
                        }
                        const pathOfMatchedOutput = path.parse(matchedOutput[0])

                        // Search for all files that are "related" to the output (currently only .css files, as assets are dealt with otherwise).
                        let relatedOutputs;
                        if (build.initialOptions.entryNames) {
                            // If entryNames is set, the related output files are more difficult to find, as the filename can also contain a hash.
                            // The hash could also be part of the path, which could make it even more difficult
                            // We therefore try to extract the dir, name and hash from the "main"-output, and try to find all files with
                            // the same [name] and [dir].
                            // This should always include the "main"-output, as well as all relatedOutputs
                            const joinedPathOfMatch = path.join(pathOfMatchedOutput.dir, pathOfMatchedOutput.name)
                            const entryNames = build.initialOptions.entryNames;
                            let findVariablesRegexString = escapeRegExp(entryNames)
                                .replace("\\\[hash\\\]", REGEXES.HASH_REGEX)
                                .replace("\\\[name\\\]", REGEXES.NAME_REGEX)
                                .replace("\\\[dir\\\]", REGEXES.DIR_REGEX);
                            const findVariablesRegex = new RegExp(findVariablesRegexString)
                            const match = findVariablesRegex.exec(joinedPathOfMatch);

                            const name = match?.groups?.['name'];
                            const dir = match?.groups?.['dir'];

                            relatedOutputs = Object.entries(result.metafile?.outputs || {}).filter(([pathOfCurrentOutput, _]) => {
                                if (build.initialOptions.entryNames) {
                                    // if a entryName is set, we need to parse the output filename, get the name and dir, 
                                    // and find files that match the same criteria
                                    let findFilesWithSameVariablesRegexString = escapeRegExp(entryNames.replace("[name]", name!).replace("[dir]", dir!))
                                        .replace("\\\[hash\\\]", REGEXES.HASH_REGEX)
                                    const findFilesWithSameVariablesRegex = new RegExp(findFilesWithSameVariablesRegexString)
                                    return findFilesWithSameVariablesRegex.test(pathOfCurrentOutput)
                                }
                            })
                        } else {
                            // If entryNames is not set, the related files are always next to the "main" output, and have the same filename, but the extension differs
                            relatedOutputs = Object.entries(result.metafile?.outputs || {}).filter(([key, _]) => {
                                return path.parse(key).name === pathOfMatchedOutput.name && path.parse(key).dir === pathOfMatchedOutput.dir
                            })
                        }

                        relevantOutputs = [...relevantOutputs, ...relatedOutputs]
                    }

                    // Next, we insert the found files into the htmlTemplate - if no htmlTemplate was specified, we default to a basic one.
                    // TODO: allow specification of path to htmlTemplate
                    const dom = new JSDOM(htmlFileConfiguration.htmlTemplate || defaultHtmlTemplate);
                    const document = dom.window.document;

                    if (htmlFileConfiguration.title) {
                        // If a title was given, we pass the title as well
                        document.title = htmlFileConfiguration.title
                    }

                    for (const [filepath, _] of relevantOutputs) {
                        const out = path.join(outdir, htmlFileConfiguration.filename)
                        const relativePath = path.relative(path.dirname(out), filepath)
                        if (path.parse(filepath).ext === ".js") {
                            const scriptTag = document.createElement("script")
                            scriptTag.setAttribute("src", relativePath)

                            // TODO: allow the user to configure if sources are defered
                            scriptTag.setAttribute("defer", "")
                            document.body.append(scriptTag)
                        } else {
                            const linkTag = document.createElement("link")
                            linkTag.setAttribute("rel", "stylesheet")
                            linkTag.setAttribute("href", relativePath)
                            document.head.appendChild(linkTag)
                        }
                    }
                    const out = path.join(outdir, htmlFileConfiguration.filename)
                    await fs.writeFile(out, dom.serialize())
                    const stat = await fs.stat(out)
                    logInfo && console.log(`  ${out} - ${stat.size}`)
                }
                logInfo && console.log(`  HTML Plugin Done in ${Date.now() - startTime}ms`)
            })
        }
    }
}
