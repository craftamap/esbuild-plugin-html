import { collectEntrypoints } from './helpers'

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
