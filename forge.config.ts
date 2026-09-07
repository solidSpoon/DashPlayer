import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerWix } from '@electron-forge/maker-wix';
// Forge 官方没有 AppImage maker，使用社区维护的 ReForged 实现（覆盖 Arch/NixOS 等无 deb/rpm 的发行版）
import { MakerAppImage } from '@reforged/maker-appimage';
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
                '/node_modules/inversify',
                '/node_modules/reflect-metadata',
                '/node_modules/undici',
                '/node_modules/fetch-socks',
                '/node_modules/socks',
                '/node_modules/smart-buffer',
                '/node_modules/ip-address',
                '/node_modules/ipaddr.js',

                '/node_modules/@huggingface/jinja',
                '/node_modules/@huggingface/transformers',
                '/node_modules/@img/',
                '/node_modules/@isaacs/fs-minipass',
                '/node_modules/@protobufjs/aspromise',
                '/node_modules/@protobufjs/base64',
                '/node_modules/@protobufjs/codegen',
                '/node_modules/@protobufjs/eventemitter',
                '/node_modules/@protobufjs/fetch',
                '/node_modules/@protobufjs/float',
                '/node_modules/@protobufjs/path',
                '/node_modules/@protobufjs/pool',
                '/node_modules/@protobufjs/utf8',
                '/node_modules/@types/node',
                '/node_modules/boolean',
                '/node_modules/chownr',
                '/node_modules/define-data-property',
                '/node_modules/define-properties',
                '/node_modules/detect-libc',
                '/node_modules/detect-node',
                '/node_modules/es-define-property',
                '/node_modules/es-errors',
                '/node_modules/es6-error',
                '/node_modules/escape-string-regexp',
                '/node_modules/flatbuffers',
                '/node_modules/global-agent',
                '/node_modules/globalthis',
                '/node_modules/gopd',
                '/node_modules/guid-typescript',
                '/node_modules/has-property-descriptors',
                '/node_modules/json-stringify-safe',
                '/node_modules/long',
                '/node_modules/lru-cache',
                '/node_modules/matcher',
                '/node_modules/minipass',
                '/node_modules/minizlib',
                '/node_modules/object-keys',
                '/node_modules/onnxruntime-common',
                '/node_modules/onnxruntime-node',
                '/node_modules/onnxruntime-web',
                '/node_modules/platform',
                '/node_modules/protobufjs',
                '/node_modules/roarr',
                '/node_modules/semver',
                '/node_modules/semver-compare',
                '/node_modules/serialize-error',
                '/node_modules/sharp',
                '/node_modules/sprintf-js',
                '/node_modules/tar',
                '/node_modules/type-fest',
                '/node_modules/undici-types',
                '/node_modules/yallist',            ];

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
        extraResource: ['./drizzle', './lib', './scripts', './resources'],
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
        // AppImage：单文件免安装格式，产物命名 DashPlayer-<version>-<arch>.AppImage。
        // bin 必须与 packagerConfig.executableName 一致，maker 会按它校验打包产物内的可执行文件。
        // icon 给出 hicolor 多尺寸集合，maker 自动把最大尺寸作为 .DirIcon 默认图标。
        new MakerAppImage({
            options: {
                name: 'dash-player',
                bin: 'dash-player',
                productName: 'DashPlayer',
                icon: {
                    '16x16': './assets/icons/16x16.png',
                    '24x24': './assets/icons/24x24.png',
                    '32x32': './assets/icons/32x32.png',
                    '48x48': './assets/icons/48x48.png',
                    '64x64': './assets/icons/64x64.png',
                    '128x128': './assets/icons/128x128.png',
                    '256x256': './assets/icons/256x256.png',
                },
                categories: ['AudioVideo', 'Video'],
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
