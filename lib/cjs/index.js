"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlPlugin = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const jsdom_1 = require("jsdom");
const helpers_1 = require("./helpers");
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
const htmlPlugin = (configuration = { files: [], }) => {
    configuration.files = configuration.files.map((htmlFileConfiguration) => {
        return Object.assign({}, { 'findRelatedOutputFiles': true }, htmlFileConfiguration); // Set default values
    });
    let logInfo = false;
    return {
        name: 'esbuild-html-plugin',
        setup(build) {
            build.onStart(() => {
                if (!build.initialOptions.metafile) {
                    throw new Error('metafile is not enabled');
                }
                if (!build.initialOptions.outdir) {
                    throw new Error('outdir must be set');
                }
            });
            build.onEnd(async (result) => {
                const startTime = Date.now();
                if (build.initialOptions.logLevel == 'debug' || build.initialOptions.logLevel == 'info') {
                    logInfo = true;
                }
                logInfo && console.log();
                for (const htmlFileConfiguration of configuration.files) {
                    // First, search for outputs with the configured entryPoints
                    const collectedEntrypoints = (0, helpers_1.collectEntrypoints)(htmlFileConfiguration, result.metafile);
                    // All output files relevant for this html file
                    let collectedOutputFiles = [];
                    for (const entrypoint of collectedEntrypoints) {
                        if (!entrypoint) {
                            throw new Error(`Found no match for ${htmlFileConfiguration.entryPoints}`);
                        }
                        let relatedOutputFiles;
                        if (htmlFileConfiguration.findRelatedOutputFiles) {
                            relatedOutputFiles = (0, helpers_1.findRelatedOutputFiles)(entrypoint, result.metafile, build.initialOptions.entryNames);
                        }
                        else {
                            relatedOutputFiles = [entrypoint];
                        }
                        collectedOutputFiles = [...collectedOutputFiles, ...relatedOutputFiles];
                    }
                    // Note: we can safely disable this rule here, as we already asserted this in setup.onStart
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const outdir = build.initialOptions.outdir;
                    const publicPath = build.initialOptions.publicPath;
                    const htmlTemplate = htmlFileConfiguration.htmlTemplate || defaultHtmlTemplate;
                    const templatingResult = (0, helpers_1.renderTemplate)(htmlFileConfiguration, htmlTemplate);
                    // Next, we insert the found files into the htmlTemplate - if no htmlTemplate was specified, we default to a basic one.
                    const dom = new jsdom_1.JSDOM(templatingResult);
                    const document = dom.window.document;
                    if (htmlFileConfiguration.title) {
                        // If a title was given, we pass the title as well
                        document.title = htmlFileConfiguration.title;
                    }
                    if (htmlFileConfiguration.favicon) {
                        // Injects a favicon if present
                        await fs_1.promises.copyFile(htmlFileConfiguration.favicon, `${outdir}/favicon.ico`);
                        const linkTag = document.createElement('link');
                        linkTag.setAttribute('rel', 'icon');
                        linkTag.setAttribute('href', '/favicon.ico');
                        document.head.appendChild(linkTag);
                    }
                    (0, helpers_1.injectFiles)(dom, collectedOutputFiles, outdir, publicPath, htmlFileConfiguration, logInfo);
                    const out = (0, helpers_1.posixJoin)(outdir, htmlFileConfiguration.filename);
                    await fs_1.promises.mkdir(path_1.default.dirname(out), {
                        recursive: true,
                    });
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
