
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        exclude: ['node_modules', 'dist-electron', '.next'],
        setupFiles: ['./src/lib/test/setup.ts'],
    },
});
