import axios from 'axios';
import { app } from 'electron';
import { compareVersions } from 'compare-versions';
import Release from "@/common/types/release";

let cache: Release[] = [];
let cacheUpdateTime = 0;

export const checkUpdate = async (): Promise<Release[]> => {
    const now = Date.now();
    // 5分钟内不重复检查更新
    if (now - cacheUpdateTime < 5 * 60 * 1000) {
        return cache;
    }

    const currentVersion = app.getVersion();

    const result = await axios
        .get(
            'https://api.github.com/repos/solidSpoon/DashPlayer/releases'
        )
        .catch((err) => {
            console.error(err);
            return null;
        });

    if (result?.status !== 200) {
        return [];
    }

    const releases: Release[] = result.data.map((release: {
        html_url: string;
        tag_name: string;
        body: string;
    }) => ({
        url: release.html_url,
        version: release.tag_name,
        content: release.body,
    }));
    console.log('releases', releases);
    cache = releases
        .filter(release => compareVersions(release.version, `v${currentVersion}`) > 0)
        .sort((a, b) => compareVersions(b.version, a.version));
    cacheUpdateTime = now;
    return cache;
};

export const appVersion = (): string => {
    return app.getVersion();
};
