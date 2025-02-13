"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlPlugin = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const jsdom_1 = require("jsdom");
const template_1 = __importDefault(require("lodash/template"));
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
    DIR_REGEX: '(?<dir>\\S+\\/?)',
    HASH_REGEX: '(?<hash>[A-Z2-7]{8})',
    NAME_REGEX: '(?<name>[^\\s\\/]+)',
};
// This function joins a path, and in case of windows, it converts backward slashes ('\') forward slashes ('/').
function posixJoin(...paths) {
    const joined = path_1.default.join(...paths);
    if (path_1.default.sep === '/') {
        return joined;
    }
    return joined.split(path_1.default.sep).join(path_1.default.posix.sep);
}
function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
const htmlPlugin = (configuration = { files: [], }) => {
    configuration.files = configuration.files.map((htmlFileConfiguration) => {
        return Object.assign({}, { findRelatedOutputFiles: false, findRelatedCssFiles: true }, htmlFileConfiguration); // Set default values
    });
    let logInfo = false;
    function collectEntrypoints(htmlFileConfiguration, metafile) {
        if (!metafile) {
            throw new Error('metafile is missing!');
        }
        const entryPoints = Object.entries(metafile?.outputs || {}).filter(([, value]) => {
            if (!value.entryPoint) {
                return false;
            }
            return htmlFileConfiguration.entryPoints.includes(value.entryPoint);
        }).map(outputData => {
            // Flatten the output, instead of returning an array, let's return an object that contains the path of the output file as path
            return { path: outputData[0], ...outputData[1] };
        });
        if (entryPoints.length < htmlFileConfiguration.entryPoints.length) {
            for (const htmlFileEntry of htmlFileConfiguration.entryPoints) {
                if (!entryPoints.some(ep => ep.entryPoint === htmlFileEntry)) {
                    console.log('⚠️ for "%s", entrypoint "%s" was requested, but not found.', htmlFileConfiguration.filename, htmlFileEntry);
                }
            }
        }
        return entryPoints;
    }
    function findNameRelatedOutputFiles(entrypoint, metafile, entryNames) {
        const pathOfMatchedOutput = path_1.default.parse(entrypoint.path);
        // Search for all files that are "related" to the output (.css and map files, for example files, as assets are dealt with otherwise).
        if (entryNames) {
            // If entryNames is set, the related output files are more difficult to find, as the filename can also contain a hash.
            // The hash could also be part of the path, which could make it even more difficult
            // We therefore try to extract the dir, name and hash from the "main"-output, and try to find all files with
            // the same [name] and [dir].
            // This should always include the "main"-output, as well as all relatedOutputs
            const joinedPathOfMatch = posixJoin(pathOfMatchedOutput.dir, pathOfMatchedOutput.name);
            const findVariablesRegexString = escapeRegExp(entryNames)
                .replace('\\[hash\\]', REGEXES.HASH_REGEX)
                .replace('\\[name\\]', REGEXES.NAME_REGEX)
                .replace('\\[dir\\]', REGEXES.DIR_REGEX);
            const findVariablesRegex = new RegExp(findVariablesRegexString);
            const match = findVariablesRegex.exec(joinedPathOfMatch);
            const name = match?.groups?.['name'];
            const dir = match?.groups?.['dir'];
            return Object.entries(metafile?.outputs || {}).filter(([pathOfCurrentOutput,]) => {
                if (entryNames) {
                    // if a entryName is set, we need to parse the output filename, get the name and dir,
                    // and find files that match the same criteria
                    const findFilesWithSameVariablesRegexString = escapeRegExp(entryNames.replace('[name]', name ?? '').replace('[dir]', dir ?? ''))
                        .replace('\\[hash\\]', REGEXES.HASH_REGEX);
                    const findFilesWithSameVariablesRegex = new RegExp(findFilesWithSameVariablesRegexString);
                    return findFilesWithSameVariablesRegex.test(pathOfCurrentOutput);
                }
            }).map(outputData => {
                // Flatten the output, instead of returning an array, let's return an object that contains the path of the output file as path
                return { path: outputData[0], ...outputData[1] };
            });
        }
        else {
            // If entryNames is not set, the related files are always next to the "main" output, and have the same filename, but the extension differs
            return Object.entries(metafile?.outputs || {}).filter(([key,]) => {
                return path_1.default.parse(key).name === pathOfMatchedOutput.name && path_1.default.parse(key).dir === pathOfMatchedOutput.dir;
            }).map(outputData => {
                // Flatten the output, instead of returning an array, let's return an object that contains the path of the output file as path
                return { path: outputData[0], ...outputData[1] };
            });
        }
    }
    async function renderTemplate({ htmlTemplate, define }) {
        const customHtmlTemplate = (htmlTemplate && fs_1.default.existsSync(htmlTemplate)
            ? await fs_1.default.promises.readFile(htmlTemplate)
            : htmlTemplate || '').toString();
        const template = customHtmlTemplate || defaultHtmlTemplate;
        const compiledTemplateFn = (0, template_1.default)(template, { interpolate: /<%=([\s\S]+?)%>/g });
        return compiledTemplateFn({ define });
    }
    // use the same joinWithPublicPath function as esbuild:
    //  https://github.com/evanw/esbuild/blob/a1ff9d144cdb8d50ea2fa79a1d11f43d5bd5e2d8/internal/bundler/bundler.go#L533
    function joinWithPublicPath(publicPath, relPath) {
        relPath = path_1.default.normalize(relPath);
        if (!publicPath) {
            publicPath = '.';
        }
        let slash = '/';
        if (publicPath.endsWith('/')) {
            slash = '';
        }
        return `${publicPath}${slash}${relPath}`;
    }
    async function injectFiles(dom, assets, outDir, publicPath, htmlFileConfiguration) {
        const document = dom.window.document;
        for (const script of htmlFileConfiguration?.extraScripts || []) {
            const scriptTag = document.createElement('script');
            if (typeof script === 'string') {
                scriptTag.setAttribute('src', script);
            }
            else {
                scriptTag.setAttribute('src', script.src);
                Object.entries(script.attrs || {}).forEach(([key, value]) => {
                    scriptTag.setAttribute(key, value);
                });
            }
            document.body.append(scriptTag);
        }
        for (const outputFile of assets) {
            const filepath = outputFile.path;
            let targetPath;
            if (publicPath) {
                targetPath = joinWithPublicPath(publicPath, path_1.default.relative(outDir, filepath));
            }
            else {
                const htmlFileDirectory = posixJoin(outDir, htmlFileConfiguration.filename);
                targetPath = path_1.default.relative(path_1.default.dirname(htmlFileDirectory), filepath);
            }
            if (htmlFileConfiguration.hash) {
                const hashableContents = htmlFileConfiguration.hash === true ? `${Date.now()}` : htmlFileConfiguration.hash;
                targetPath = `${targetPath}?${crypto_1.default.createHash('md5').update(hashableContents).digest('hex')}`;
            }
            const ext = path_1.default.parse(filepath).ext;
            // Inline the JavaScript and CSS files if the option is set.
            const { inline } = htmlFileConfiguration;
            const isInline = () => {
                if (!inline) {
                    return false;
                }
                const extension = ext.replace('.', '');
                return ((typeof inline === 'boolean' && inline === true) ||
                    (typeof inline === 'object' && inline[extension] === true) ||
                    (typeof inline === 'function' && inline(filepath)));
            };
            if (ext === '.js') {
                const scriptTag = document.createElement('script');
                // Check if the JavaScript should be inlined.
                if (isInline()) {
                    if (logInfo) {
                        console.log('Inlining script', filepath);
                    }
                    // Read the content of the JavaScript file, then append to the script tag
                    const scriptContent = await fs_1.default.promises.readFile(filepath, 'utf-8');
                    scriptTag.textContent = scriptContent;
                }
                else {
                    // If not inlined, set the 'src' attribute as usual.
                    scriptTag.setAttribute('src', targetPath);
                }
                if (htmlFileConfiguration.scriptLoading === 'module') {
                    // If module, add type="module"
                    scriptTag.setAttribute('type', 'module');
                }
                else if (!isInline() && (!htmlFileConfiguration.scriptLoading || htmlFileConfiguration.scriptLoading === 'defer')) {
                    // if scriptLoading is unset or defer, use defer
                    scriptTag.setAttribute('defer', '');
                }
                document.body.append(scriptTag);
            }
            else if (ext === '.css') {
                // Check if the CSS should be inlined -> if so, use style tags instead of link tags.
                if (isInline()) {
                    const styleTag = document.createElement('style');
                    const styleContent = await fs_1.default.promises.readFile(filepath, 'utf-8');
                    styleTag.textContent = styleContent;
                    document.head.append(styleTag);
                    // no need to set any attributes
                    continue;
                }
                const linkTag = document.createElement('link');
                linkTag.setAttribute('rel', 'stylesheet');
                linkTag.setAttribute('href', targetPath);
                document.head.appendChild(linkTag);
            }
            else {
                if (logInfo) {
                    console.log(`Warning: found file ${targetPath}, but it was neither .js nor .css`);
                }
            }
        }
    }
    return {
        name: 'esbuild-html-plugin',
        setup(build) {
            if (build.initialOptions.metafile === false) {
                throw new Error('metafile is explictly disabled. @craftamap/esbuild-html-plugin needs this to be enabled.');
            }
            // we need the metafile. If it's not set, we can set it to `true`
            build.initialOptions.metafile = true;
            if (!build.initialOptions.outdir) {
                throw new Error('outdir must be set');
            }
            build.onEnd(async (result) => {
                const startTime = Date.now();
                if (build.initialOptions.logLevel == 'debug' || build.initialOptions.logLevel == 'info') {
                    logInfo = true;
                }
                if (logInfo) {
                    console.log();
                }
                for (const htmlFileConfiguration of configuration.files) {
                    // First, search for outputs with the configured entryPoints
                    const collectedEntrypoints = collectEntrypoints(htmlFileConfiguration, result.metafile);
                    // All output files relevant for this html file
                    let collectedOutputFiles = [];
                    for (const entrypoint of collectedEntrypoints) {
                        if (!entrypoint) {
                            throw new Error(`Found no match for ${htmlFileConfiguration.entryPoints}`);
                        }
                        const relatedOutputFiles = new Map();
                        relatedOutputFiles.set(entrypoint.path, entrypoint);
                        if (htmlFileConfiguration.findRelatedCssFiles) {
                            if (entrypoint?.cssBundle) {
                                relatedOutputFiles.set(entrypoint.cssBundle, { path: entrypoint?.cssBundle });
                            }
                        }
                        if (htmlFileConfiguration.findRelatedOutputFiles) {
                            findNameRelatedOutputFiles(entrypoint, result.metafile, build.initialOptions.entryNames).forEach((item) => {
                                relatedOutputFiles.set(item.path, item);
                            });
                        }
                        collectedOutputFiles = [...collectedOutputFiles, ...relatedOutputFiles.values()];
                    }
                    // Note: we can safely disable this rule here, as we already asserted this in setup.onStart
                    const outdir = build.initialOptions.outdir;
                    const publicPath = build.initialOptions.publicPath;
                    const templatingResult = await renderTemplate(htmlFileConfiguration);
                    // Next, we insert the found files into the htmlTemplate - if no htmlTemplate was specified, we default to a basic one.
                    const dom = new jsdom_1.JSDOM(templatingResult);
                    const document = dom.window.document;
                    if (htmlFileConfiguration.title) {
                        // If a title was given, we pass the title as well
                        document.title = htmlFileConfiguration.title;
                    }
                    if (htmlFileConfiguration.favicon) {
                        // Injects a favicon if present
                        if (!fs_1.default.existsSync(htmlFileConfiguration.favicon)) {
                            throw new Error('favicon specified but does not exist');
                        }
                        const fileExt = path_1.default.extname(htmlFileConfiguration.favicon);
                        const faviconName = 'favicon' + fileExt;
                        await fs_1.default.promises.copyFile(htmlFileConfiguration.favicon, `${outdir}/${faviconName}`);
                        const linkTag = document.createElement('link');
                        linkTag.setAttribute('rel', 'icon');
                        let faviconPublicPath = `/${faviconName}`;
                        if (publicPath) {
                            faviconPublicPath = joinWithPublicPath(publicPath, faviconPublicPath);
                        }
                        linkTag.setAttribute('href', faviconPublicPath);
                        document.head.appendChild(linkTag);
                    }
                    await injectFiles(dom, collectedOutputFiles, outdir, publicPath, htmlFileConfiguration);
                    const out = posixJoin(outdir, htmlFileConfiguration.filename);
                    await fs_1.default.promises.mkdir(path_1.default.dirname(out), {
                        recursive: true,
                    });
                    await fs_1.default.promises.writeFile(out, dom.serialize());
                    const stat = await fs_1.default.promises.stat(out);
                    if (logInfo) {
                        console.log(`  ${out} - ${stat.size}`);
                    }
                }
                if (logInfo) {
                    console.log(`  HTML Plugin Done in ${Date.now() - startTime}ms`);
                }
            });
        }
    };
};
exports.htmlPlugin = htmlPlugin;
