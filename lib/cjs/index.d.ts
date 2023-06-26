import esbuild from 'esbuild';
export interface Configuration {
    files: HtmlFileConfiguration[];
}
export interface HtmlFileConfiguration {
    /** @param filename The name of the output HTML file (relative to the output directory) */
    filename: string;
    /** @param entryPoints The entry points to include in the HTML file. */
    entryPoints: string[];
    /** @param title The title of the HTML file. */
    title?: string;
    /** @param htmlTemplate A path to a custom HTML template to use. If not set, a default template will be used. */
    htmlTemplate?: string;
    /** @param define A map of variables that will be available in the HTML file. */
    define?: Record<string, string>;
    /** @param scriptLoading How to load the generated script tags: blocking, defer, or module. Defaults to defer. */
    scriptLoading?: 'blocking' | 'defer' | 'module';
    /** @param favicon A path to a favicon to use. */
    favicon?: string;
    /** @param findRelatedCssFiles Whether to find CSS files that are related to the entry points. */
    findRelatedCssFiles?: boolean;
    /**
     * @deprecated Use findRelatedCssFiles instead.
     * @param findRelatedOutputFiles Whether to find output files that are related to the entry points. */
    findRelatedOutputFiles?: boolean;
    /** @param inline Whether to inline the content of the js and css files. */
    inline?: boolean | {
        css?: boolean;
        js?: boolean;
    };
    /** @param extraScripts Extra script tags to include in the HTML file. */
    extraScripts?: (string | {
        src: string;
        attrs?: {
            [key: string]: string;
        };
    })[];
    hash?: boolean | string;
}
export declare const htmlPlugin: (configuration?: Configuration) => esbuild.Plugin;
