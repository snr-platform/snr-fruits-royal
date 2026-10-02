import { defineConfig } from 'vite';

export default defineConfig({
    root: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false
    },
    server: {
        host: true,
        port: 3000
    }
});
