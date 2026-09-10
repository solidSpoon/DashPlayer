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

/**
 * 判断路径是否存在（fs/promises 没有 exists）。
 *
 * @param target 待检查的绝对路径。
 * @returns 路径存在时返回 true。
 */
const pathExists = async (target: string): Promise<boolean> => {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
};

/**
 * 打包时裁掉非目标平台/架构的原生库变体。
 *
 * 背景：onnxruntime-node 会把 darwin/linux/win32 × x64/arm64 六套预编译库
 * （约 208MB）一起装进 node_modules，其中 5/6 对当前产物毫无用处；这些异架构
 * ELF 还会让 Linux RPM 打包阶段的 brp-strip 报 "Unable to recognise the
 * format" 而整包失败。sharp 的平台包、better-sqlite3 的预编译目录同理。
 *
 * @param buildPath 打包暂存目录（应用根目录）。
 * @param platform 目标平台（darwin/linux/win32/mas）。
 * @param arch 目标架构（x64/arm64/ia32）。
 */
const pruneForeignNativeVariants = async (buildPath: string, platform: string, arch: string): Promise<void> => {
    // mac App Store 构建的原生库目录名与 darwin 一致
    const nativePlatform = platform === 'mas' ? 'darwin' : platform;

    const drop = async (target: string): Promise<void> => {
        if (!await pathExists(target)) return;
        await fs.rm(target, { recursive: true, force: true });
        console.log(`[prune-native] 移除 ${path.relative(buildPath, target)}`);
    };

    // onnxruntime-node：bin/napi-v3/<platform>/<arch> 只保留目标组合
    const variantsRoot = path.join(buildPath, 'node_modules/onnxruntime-node/bin/napi-v3');
    if (await pathExists(variantsRoot)) {
        for (const variantPlatform of await fs.readdir(variantsRoot)) {
            const platformDir = path.join(variantsRoot, variantPlatform);
            if (variantPlatform !== nativePlatform) {
                await drop(platformDir);
                continue;
            }
            for (const variantArch of await fs.readdir(platformDir)) {
                if (variantArch !== arch) {
                    await drop(path.join(platformDir, variantArch));
                }
            }
        }
    }

    // sharp：@img/sharp-<platform>-<arch>、@img/sharp-libvips-<platform>-<arch>
    const imgRoot = path.join(buildPath, 'node_modules/@img');
    if (await pathExists(imgRoot)) {
        for (const pkg of await fs.readdir(imgRoot)) {
            if (!pkg.startsWith('sharp-') || pkg.includes(`-${nativePlatform}-${arch}`)) continue;
            await drop(path.join(imgRoot, pkg));
        }
    }

    // better-sqlite3：bin/<platform>-<arch>-<abi> 只保留目标组合
    const sqliteBinRoot = path.join(buildPath, 'node_modules/better-sqlite3/bin');
    if (await pathExists(sqliteBinRoot)) {
        for (const variant of await fs.readdir(sqliteBinRoot)) {
            if (variant.startsWith(`${nativePlatform}-${arch}-`)) continue;
            await drop(path.join(sqliteBinRoot, variant));
        }
    }
};


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
                '/node_modules/yallist',
            ];

            // ignore 返回 true 时 electron-packager 会连整棵子树一起跳过，
            // 所以除了白名单路径自身，还必须放行它的所有祖先目录：
            // 只写 `/node_modules/@huggingface/transformers` 而漏掉父目录
            // `/node_modules/@huggingface` 时，scoped 依赖会整体丢包
            // （打包版启动即 Cannot find module '@huggingface/transformers'）。
            for (const prefix of keptNodeModulePrefixes) {
                // 兼容 `/node_modules/@img/` 这类带结尾斜杠的写法
                const normalized = prefix.replace(/\/+$/, '');
                if (file === normalized
                    || file.startsWith(`${normalized}/`)
                    || normalized.startsWith(`${file}/`)) {
                    return false;
                }
            }

            return true;
        },
        asar: {
            // 原生库必须解到 app.asar.unpacked：dyld/ld.so 读不了 asar 内部，
            // 例如 onnxruntime 的 binding.node 会按 @rpath（自身目录）找
            // libonnxruntime.*，只解包 .node 会导致 dlopen 报 Library not loaded。
            unpack: '**/*.{wasm,node,dylib,so,so.*}',
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
        // 在 asar 打包前裁掉异平台/异架构原生库（同时避免 Linux RPM 的 brp-strip 失败）
        packageAfterCopy: async (_forgeConfig, buildPath, _electronVersion, platform, arch) => {
            await pruneForeignNativeVariants(buildPath, platform, arch);
        },
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
