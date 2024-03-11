import type {ForgeConfig} from '@electron-forge/shared-types';
import {MakerDeb} from '@electron-forge/maker-deb';
import {MakerRpm} from '@electron-forge/maker-rpm';
import {VitePlugin} from '@electron-forge/plugin-vite';
import MakerDMG from "@electron-forge/maker-dmg";
import MakerSquirrel from "@electron-forge/maker-squirrel";

const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        icon: './assets/icons/icon',
        extraResource: ["./drizzle"],
        executableName: 'dash-player',
        name: 'DashPlayer',
    },
    rebuildConfig: {},
    makers: [
        new MakerSquirrel({
            name: 'DashPlayer',
            loadingGif: './assets/icons/install.png',
            setupIcon: './assets/icons/icon.ico',
            iconUrl: 'https://raw.githubusercontent.com/solidSpoon/dp2/master/assets/icons/icon.ico',
        }),
        new MakerDMG({
            icon: './assets/icons/icon.icns',
            format: 'ULFO'
        }),
        new MakerRpm({
            options: {
                name: 'dash-player',
                productName: 'DashPlayer',
                icon: './assets/icons/icon.png',
            }
        }),
        new MakerDeb({
            options: {
                name: 'dash-player',
                productName: 'DashPlayer',
                icon: './assets/icons/icon.png',
            }
        })],
    plugins: [
        new VitePlugin({
            // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
            // If you are familiar with Vite configuration, it will look really familiar.
            build: [
                {
                    // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                    entry: 'src/main.ts',
                    config: 'vite.main.config.ts',
                },
                {
                    entry: 'src/preload.ts',
                    config: 'vite.preload.config.ts',
                },
            ],
            renderer: [
                {
                    name: 'main_window',
                    config: 'vite.renderer.config.ts',
                },
            ],
        }),
    ],
    publishers: [
        {
            name: '@electron-forge/publisher-github',
            config: {
                repository: {
                    owner: 'solidSpoon',
                    name: 'dp2'
                },
                prerelease: true
            }
        }
    ]
};

export default config;
