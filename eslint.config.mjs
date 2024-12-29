import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    ...[
        eslint.configs.recommended,
        ...tseslint.configs.recommended,
    ].map(conf => ({
        ...conf,
        files: ['**/*.ts'],
    })),
    {
        files: ['**/*.ts'],
        rules: {
            "indent": [
                "error",
                4
            ],
            "linebreak-style": [
                "error",
                "unix"
            ],
            "quotes": [
                "error",
                "single"
            ],
            "semi": [
                "error",
                "never"
            ]
        },
    },
];
