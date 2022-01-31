import esbuild from 'esbuild';
interface Configuration {
    files: HtmlFileConfiguration[];
}
interface HtmlFileConfiguration {
    filename: string;
    entryPoints: string[];
    title?: string;
    htmlTemplate?: string;
    scriptLoading?: 'blocking' | 'defer' | 'module';
}
export declare const htmlPlugin: (configuration?: Configuration) => esbuild.Plugin;
export {};
