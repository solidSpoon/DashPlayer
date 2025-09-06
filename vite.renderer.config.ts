import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig((env) => {
    const forgeEnv = env as ConfigEnv<'renderer'>;
    const { root, mode, forgeConfigSelf } = forgeEnv;
    const name = forgeConfigSelf.name ?? '';

    return {
        root,
        mode,
        base: './',
        build: {
            outDir: `.vite/renderer/${name}`,
            rollupOptions: {
                external: [
                    'tiktoken',
                    '@dqbd/tiktoken',
                    '@dqbd/tiktoken/lite'
                ],
            },
        },
        plugins: [pluginExposeRenderer(name), react()],
        resolve: {
            preserveSymlinks: true,
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        optimizeDeps: {
            exclude: [
                'tiktoken',
                '@dqbd/tiktoken',
                '@dqbd/tiktoken/lite'
            ],
        },
        clearScreen: false,
    } as UserConfig;
});
