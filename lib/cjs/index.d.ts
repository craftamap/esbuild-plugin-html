import esbuild from 'esbuild';
interface Configuration {
    files: HtmlFileConfiguration[];
}
interface HtmlFileConfiguration {
    filename: string;
    entryPoints: string[];
    title?: string;
    htmlTemplate?: string;
    define?: Record<string, string>;
    scriptLoading?: 'blocking' | 'defer' | 'module';
    favicon?: string;
}
export declare const htmlPlugin: (configuration?: Configuration) => esbuild.Plugin;
export {};
