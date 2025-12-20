import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerWix } from '@electron-forge/maker-wix';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import MakerDMG from '@electron-forge/maker-dmg';
import packageJson from './package.json';
import path from 'node:path';
import fs from 'node:fs/promises';


const config: ForgeConfig = {
    packagerConfig: {
        // `@electron-forge/plugin-vite` defaults to packaging only `/.vite/**`.
        // DashPlayer has runtime deps (incl. native modules) that must ship with the app.
        // Keep the package small by still ignoring everything else.
        ignore: (file: string) => {
            if (!file) return false;
            if (file.startsWith('/.vite')) return false;
            if (file === '/node_modules') return false;

            // Only ship the minimum set of runtime deps from `node_modules`.
            // Everything else should be bundled by Vite into `/.vite/**`.
            const keptNodeModulePrefixes = [
                '/node_modules/better-sqlite3',
                '/node_modules/bindings',
                '/node_modules/file-uri-to-path',
                '/node_modules/fluent-ffmpeg',
                '/node_modules/async',
                '/node_modules/which',
                '/node_modules/isexe',
                '/node_modules/inversify',
                '/node_modules/reflect-metadata',
                '/node_modules/sherpa-onnx-node',
                '/node_modules/sherpa-onnx-darwin-arm64',
                '/node_modules/sherpa-onnx-darwin-x64',
            ];

            for (const prefix of keptNodeModulePrefixes) {
                if (file === prefix || file.startsWith(`${prefix}/`)) {
                    return false;
                }
            }

            return true;
        },
        asar: {
            unpack: '**/*.{wasm,node}',
        },
        icon: './assets/icons/icon',
        extraResource: ['./drizzle', './lib', './scripts'],
        executableName: 'dash-player',
        name: 'DashPlayer',
    },
    rebuildConfig: {},
    makers: [
        new MakerSquirrel({
            name: 'DashPlayer',
            loadingGif: './assets/icons/install.png',
            setupIcon: './assets/icons/icon.ico',
            iconUrl: 'https://raw.githubusercontent.com/solidSpoon/DashPlayer/master/assets/icons/icon.ico',
        }),
        new MakerDMG({
            icon: './assets/icons/icon.icns',
            format: 'ULFO',
        }),
        new MakerRpm({
            options: {
                name: 'dash-player',
                bin: 'dash-player',
                productName: 'DashPlayer',
                icon: './assets/icons/icon.png',
            },
        }),
        new MakerDeb({
            options: {
                name: 'dash-player',
                bin: 'dash-player',
                productName: 'DashPlayer',
                icon: './assets/icons/icon.png',
            },
        }),
        new MakerWix({
            name: 'DashPlayer',
            description: 'A video player for English learning',
            manufacturer: 'solidSpoon',
            version: packageJson.version,
            icon: './assets/icons/icon.ico',
            exe: 'dash-player.exe',
            ui: {
                chooseDirectory: true,
            },
        }),
    ],
    plugins: [
        new VitePlugin({
            build: [
                { entry: 'src/main.ts', config: 'vite.main.config.ts' },
                { entry: 'src/preload.ts', config: 'vite.preload.config.ts' },
            ],
            renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
        }),
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
    publishers: [
        {
            name: '@electron-forge/publisher-github',
            config: {
                repository: { owner: 'solidSpoon', name: 'DashPlayer' },
                prerelease: true,
            },
        },
    ],
    hooks: {
        postMake: async (_forgeConfig, makeResults) => {
            const version = packageJson.version;
            for (const result of makeResults) {
                if (result.platform !== 'win32') continue;
                for (let i = 0; i < result.artifacts.length; i++) {
                    const oldPath = result.artifacts[i];
                    if (!oldPath.toLowerCase().endsWith('.msi')) continue;
                    const dir = path.dirname(oldPath);
                    const arch = result.arch; // 'x64' | 'ia32' | 'arm64'
                    const newPath = path.join(dir, `DashPlayer-${version}-${arch}.msi`);
                    if (oldPath !== newPath) {
                        await fs.rename(oldPath, newPath);
                        // 更新 artifacts，确保 Publisher 上传重命名后的文件
                        result.artifacts[i] = newPath;
                        console.log(`Renamed MSI: ${oldPath} -> ${newPath}`);
                    }
                }
            }
            return makeResults;
        },
    },
};

export default config;
