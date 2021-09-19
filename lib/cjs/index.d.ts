import esbuild from "esbuild";
interface Configuration {
    files: HtmlFileConfiguration[];
}
interface HtmlFileConfiguration {
    filename: string;
    entryPoints: string[];
    title?: string;
    htmlTemplate?: string;
}
export declare const htmlPlugin: (configuration?: Configuration) => esbuild.Plugin;
export {};
