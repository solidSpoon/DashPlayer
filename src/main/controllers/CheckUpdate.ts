import axios from 'axios';
import { app } from 'electron';

export interface Release {
    url: string;
    version: string;
    content: string;
}

let cache: Release | null = null;
let cacheUpdateTime = 0;

export const checkUpdate = async (): Promise<Release | null> => {
    const now = Date.now();
    // 5分钟内不重复检查更新
    if (cache && now - cacheUpdateTime < 5 * 60 * 1000) {
        return cache;
    }

    const currentVersion = app.getVersion();

    const result = await axios
        .get(
            'https://api.github.com/repos/solidSpoon/DashPlayer/releases/latest'
        )
        .catch((err) => {
            console.error(err);
            return null;
        });

    if (result?.status !== 200) {
        return null;
    }

    if (result.data.tag_name === `v${currentVersion}`) {
        return null;
    }

    cache = {
        url: result.data.html_url,
        version: result.data.tag_name,
        content: result.data.body,
    };
    cacheUpdateTime = now;
    return cache;

    //
};

export const appVersion = (): string => {
    return app.getVersion();
};
