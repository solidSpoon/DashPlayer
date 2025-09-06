import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vite';
import { getBuildConfig, getBuildDefine, external, pluginHotRestart } from './vite.base.config';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig((env) => {
    const forgeEnv = env as ConfigEnv<'build'>;
    const { forgeConfigSelf } = forgeEnv;
    const define = getBuildDefine(forgeEnv);
    const config: UserConfig = {
        build: {
            lib: {
                entry: forgeConfigSelf.entry!,
                fileName: () => '[name].js',
                formats: ['cjs'],
            },
            // https://github.com/electron/forge/issues/3398
            sourcemap: true,
            target: 'node20',
            rollupOptions: {
                external: [
                    ...external,
                    'echogarden',
                    'echogarden/dist/api/API.js',
                    'echogarden/dist/audio/AudioUtilities.js',
                    'echogarden/dist/utilities/Timeline.js',
                    'echogarden/dist/utilities/PackageManager.js',
                ],
                output: {
                    strict: false,
                },
            },
        },
        optimizeDeps: {
            exclude: [
                'echogarden'
            ],
        },
        plugins: [pluginHotRestart('restart')],
        define,
        resolve: {
            // Load the Node.js entry.
            mainFields: ['module', 'jsnext:main', 'jsnext'],
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },


    };

    return mergeConfig(getBuildConfig(forgeEnv), config);
});
