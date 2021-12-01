"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlPlugin = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const jsdom_1 = require("jsdom");
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
function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
const htmlPlugin = (configuration = { files: [], }) => {
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
            });
            build.onEnd(async (result) => {
                var _a, _b, _c, _d, _e;
                const startTime = Date.now();
                let logInfo = false;
                if (build.initialOptions.logLevel == 'debug' || build.initialOptions.logLevel == 'info') {
                    logInfo = true;
                }
                logInfo && console.log();
                const outdir = build.initialOptions.outdir;
                for (const htmlFileConfiguration of configuration.files) {
                    // First, search for outputs with the configured entryPoints
                    const matchedOutputs = Object.entries(((_a = result.metafile) === null || _a === void 0 ? void 0 : _a.outputs) || {}).filter(([_, value]) => {
                        return htmlFileConfiguration.entryPoints.includes(value.entryPoint);
                    });
                    let relevantOutputs = [];
                    for (const matchedOutput of matchedOutputs) {
                        if (!matchedOutputs) {
                            throw new Error(`Found no match for ${htmlFileConfiguration.entryPoints}`);
                        }
                        const pathOfMatchedOutput = path_1.default.parse(matchedOutput[0]);
                        // Search for all files that are "related" to the output (currently only .css files, as assets are dealt with otherwise).
                        let relatedOutputs;
                        if (build.initialOptions.entryNames) {
                            // If entryNames is set, the related output files are more difficult to find, as the filename can also contain a hash.
                            // The hash could also be part of the path, which could make it even more difficult
                            // We therefore try to extract the dir, name and hash from the "main"-output, and try to find all files with
                            // the same [name] and [dir].
                            // This should always include the "main"-output, as well as all relatedOutputs
                            const joinedPathOfMatch = path_1.default.join(pathOfMatchedOutput.dir, pathOfMatchedOutput.name);
                            const entryNames = build.initialOptions.entryNames;
                            let findVariablesRegexString = escapeRegExp(entryNames)
                                .replace("\\\[hash\\\]", REGEXES.HASH_REGEX)
                                .replace("\\\[name\\\]", REGEXES.NAME_REGEX)
                                .replace("\\\[dir\\\]", REGEXES.DIR_REGEX);
                            const findVariablesRegex = new RegExp(findVariablesRegexString);
                            const match = findVariablesRegex.exec(joinedPathOfMatch);
                            const name = (_b = match === null || match === void 0 ? void 0 : match.groups) === null || _b === void 0 ? void 0 : _b['name'];
                            const dir = (_c = match === null || match === void 0 ? void 0 : match.groups) === null || _c === void 0 ? void 0 : _c['dir'];
                            relatedOutputs = Object.entries(((_d = result.metafile) === null || _d === void 0 ? void 0 : _d.outputs) || {}).filter(([pathOfCurrentOutput, _]) => {
                                if (build.initialOptions.entryNames) {
                                    // if a entryName is set, we need to parse the output filename, get the name and dir, 
                                    // and find files that match the same criteria
                                    let findFilesWithSameVariablesRegexString = escapeRegExp(entryNames.replace("[name]", name).replace("[dir]", dir))
                                        .replace("\\\[hash\\\]", REGEXES.HASH_REGEX);
                                    const findFilesWithSameVariablesRegex = new RegExp(findFilesWithSameVariablesRegexString);
                                    return findFilesWithSameVariablesRegex.test(pathOfCurrentOutput);
                                }
                            });
                        }
                        else {
                            // If entryNames is not set, the related files are always next to the "main" output, and have the same filename, but the extension differs
                            relatedOutputs = Object.entries(((_e = result.metafile) === null || _e === void 0 ? void 0 : _e.outputs) || {}).filter(([key, _]) => {
                                return path_1.default.parse(key).name === pathOfMatchedOutput.name && path_1.default.parse(key).dir === pathOfMatchedOutput.dir;
                            });
                        }
                        relevantOutputs = [...relevantOutputs, ...relatedOutputs];
                    }
                    // Next, we insert the found files into the htmlTemplate - if no htmlTemplate was specified, we default to a basic one.
                    // TODO: allow specification of path to htmlTemplate
                    const dom = new jsdom_1.JSDOM(htmlFileConfiguration.htmlTemplate || defaultHtmlTemplate);
                    const document = dom.window.document;
                    if (htmlFileConfiguration.title) {
                        // If a title was given, we pass the title as well
                        document.title = htmlFileConfiguration.title;
                    }
                    for (const [filepath, _] of relevantOutputs) {
                        const out = path_1.default.join(outdir, htmlFileConfiguration.filename);
                        const relativePath = path_1.default.relative(path_1.default.dirname(out), filepath);
                        const ext = path_1.default.parse(filepath).ext;
                        if (ext === ".js") {
                            const scriptTag = document.createElement("script");
                            scriptTag.setAttribute("src", relativePath);
                            if (htmlFileConfiguration.scriptLoading === "module") {
                                // If module, add type="module"
                                scriptTag.setAttribute("type", "module");
                            }
                            else if (!htmlFileConfiguration.scriptLoading || htmlFileConfiguration.scriptLoading === "defer") {
                                // if scriptLoading is unset, or defer, use defer
                                scriptTag.setAttribute("defer", "");
                            }
                            document.body.append(scriptTag);
                        }
                        else if (ext === ".css") {
                            const linkTag = document.createElement("link");
                            linkTag.setAttribute("rel", "stylesheet");
                            linkTag.setAttribute("href", relativePath);
                            document.head.appendChild(linkTag);
                        }
                        else {
                            logInfo && console.log(`Warning: found file ${relativePath}, but it was neither .js nor .css`);
                        }
                    }
                    const out = path_1.default.join(outdir, htmlFileConfiguration.filename);
                    await fs_1.promises.writeFile(out, dom.serialize());
                    const stat = await fs_1.promises.stat(out);
                    logInfo && console.log(`  ${out} - ${stat.size}`);
                }
                logInfo && console.log(`  HTML Plugin Done in ${Date.now() - startTime}ms`);
            });
        }
    };
};
exports.htmlPlugin = htmlPlugin;
