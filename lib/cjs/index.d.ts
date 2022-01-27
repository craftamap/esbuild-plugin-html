import esbuild from "esbuild";
interface Configuration {
    files: HtmlFileConfiguration[];
}
interface HtmlFileConfiguration {
    filename: string;
    entryPoints: string[];
    title?: string;
    htmlTemplate?: string;
    define?: HtmlFileConfigurationDefine;
    scriptLoading?: 'blocking' | 'defer' | 'module';
}
declare type HtmlFileConfigurationDefine = Record<string, string>;
export declare const htmlPlugin: (configuration?: Configuration) => esbuild.Plugin;
export {};
