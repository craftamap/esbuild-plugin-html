import type { HtmlFileConfiguration } from '.';
import type esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
export declare function posixJoin(...paths: string[]): string;
export declare function collectEntrypoints(htmlFileConfiguration: HtmlFileConfiguration, metafile?: esbuild.Metafile): {
    bytes: number;
    inputs: {
        [path: string]: {
            bytesInOutput: number;
        };
    };
    imports: {
        path: string;
        kind: esbuild.ImportKind;
    }[];
    exports: string[];
    entryPoint?: string | undefined;
    path: string;
}[];
export declare function findRelatedOutputFiles(entrypoint: {
    path: string;
}, metafile?: esbuild.Metafile, entryNames?: string): {
    bytes: number;
    inputs: {
        [path: string]: {
            bytesInOutput: number;
        };
    };
    imports: {
        path: string;
        kind: esbuild.ImportKind;
    }[];
    exports: string[];
    entryPoint?: string | undefined;
    path: string;
}[];
export declare function renderTemplate(htmlFileConfiguration: HtmlFileConfiguration, htmlTemplate: string): string;
export declare function injectFiles(dom: JSDOM, assets: {
    path: string;
}[], outDir: string, publicPath: string | undefined, htmlFileConfiguration: HtmlFileConfiguration, logInfo: boolean): void;
