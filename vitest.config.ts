import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    resolve: {
        alias: {
            obsidian: resolve(__dirname, '__mocks__/obsidian.ts'),
        },
        extensions: ['.ts', '.js'],
    },
    test: {
        environment: 'node',
        resolveSnapshotPath: (testPath, snapshotExtension) => testPath + snapshotExtension,
    },
});
