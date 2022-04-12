import { collectEntrypoints, findRelatedOutputFiles, posixJoin } from './helpers'

describe('posixJoin (ensure this works on windows, too)', () => {
    test('joining >2 relative paths', () => {
        const path = posixJoin('foo', 'bar', 'baz')
        expect(path).toEqual('foo/bar/baz')
    })
    test('joining 2 relative paths', () => {
        const path = posixJoin('foo/bar', 'baz')
        expect(path).toEqual('foo/bar/baz')
    })
    test('joining 2 absolute paths', () => {
        const path = posixJoin('/foo/bar', 'baz')
        expect(path).toEqual('/foo/bar/baz')
    })
})

// === collectEntrypoints
describe('collectEntrypoints', () => {
    test('collecting a single entrypoint from a esbuild metafile', () => {
        const collectedEntrypoints = collectEntrypoints({
            filename: '',
            entryPoints: ['index.js']
        }, {
            inputs: {}, outputs: {
                'index.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' }
            }
        })
        expect(collectedEntrypoints).toEqual(
            [expect.objectContaining({
                path: 'index.js',
            })]
        )
    })

    test('collecting multiple entrypoints from a esbuild metafile', () => {
        const collectedEntrypoints = collectEntrypoints({
            filename: '',
            entryPoints: ['index.js', 'foo.js']
        }, {
            inputs: {}, outputs: {
                'index.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
                'foo.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'foo.js' }
            }
        })
        expect(collectedEntrypoints).toEqual(
            [
                expect.objectContaining({
                    path: 'index.js',
                }),
                expect.objectContaining({
                    path: 'foo.js',
                })
            ]
        )
    })

    test('collecting multiple entrypoints from a esbuild metafile, but one entrypoint is missing', () => {
        const collectedEntrypoints = collectEntrypoints({
            filename: '',
            entryPoints: ['index.js', 'foo.js']
        }, {
            inputs: {}, outputs: {
                'index.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
            }
        })
        expect(collectedEntrypoints).toEqual(
            [
                expect.objectContaining({
                    path: 'index.js',
                }),
            ]
        )
    })
})

// === findRelatedOutputFiles
describe('findrelatedOutputFiles', () => {
    test('finding related output files, entryNames is not set, a single css file is related', () => {
        const relatedOutputFiles = findRelatedOutputFiles({ path: 'dist/index.js' }, {
            inputs: {}, outputs: {
                'dist/index.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
                'dist/index.css': { bytes: 0, inputs: {}, imports: [], exports: [] },
                'dist/anotherfile-index.css': { bytes: 0, inputs: {}, imports: [], exports: [] }, // This file should not be found
            }
        }, undefined)

        expect(relatedOutputFiles).toEqual([
            { path: 'dist/index.js', bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
            { path: 'dist/index.css', bytes: 0, inputs: {}, imports: [], exports: [] },
        ])
    })

    test('finding related output files, entryNames is set, a single css file is related', () => {
        const relatedOutputFiles = findRelatedOutputFiles({ path: 'dist/index-ABCDE234.js' }, {
            inputs: {}, outputs: {
                'dist/index-ABCDE234.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
                'dist/index-FGHIJ324.css': { bytes: 0, inputs: {}, imports: [], exports: [] },
                'dist/anotherfile-KLMNO423.css': { bytes: 0, inputs: {}, imports: [], exports: [] }, // This file should not be found
            }
        }, '[dir]/[name]-[hash]')

        expect(relatedOutputFiles).toEqual([
            { path: 'dist/index-ABCDE234.js', bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
            { path: 'dist/index-FGHIJ324.css', bytes: 0, inputs: {}, imports: [], exports: [] },
        ])
    })

    test('finding related output files, entryNames is set, complex path, a single css file is related', () => {
        const relatedOutputFiles = findRelatedOutputFiles({ path: 'dist/foo/index-ABCDE234.js' }, {
            inputs: {}, outputs: {
                'dist/foo/index-ABCDE234.js': { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
                'dist/foo/index-FGHIJ324.css': { bytes: 0, inputs: {}, imports: [], exports: [] },
                'dist/anotherdir/index-KLMNO423.css': { bytes: 0, inputs: {}, imports: [], exports: [] }, // This file should not be found
            }
        }, '[dir]/[name]-[hash]')

        expect(relatedOutputFiles).toEqual([
            { path: 'dist/foo/index-ABCDE234.js', bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: 'index.js' },
            { path: 'dist/foo/index-FGHIJ324.css', bytes: 0, inputs: {}, imports: [], exports: [] },
        ])
    })
})
