import axios from 'axios';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import { compareVersions } from 'compare-versions';
import Release from "@/common/types/release";
import {app} from "electron";

let cache: Release[] = [];
let cacheUpdateTime = 0;

export const checkUpdate = async (): Promise<Release[]> => {
    const now = Date.now();
    // 5分钟内不重复检查更新
    if (now - cacheUpdateTime < 5 * 60 * 1000) {
        return cache;
    }

    const currentVersion = app.getVersion();

    const logger = getMainLogger('CheckUpdate');
    const result = await axios
        .get(
            'https://api.github.com/repos/solidSpoon/DashPlayer/releases'
        )
        .catch((err) => {
            logger.error('failed to fetch releases', { error: err.message });
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
    logger.info('fetched releases from github', { count: releases.length });
    cache = releases
        .filter(release => compareVersions(release.version, `v${currentVersion}`) > 0)
        .sort((a, b) => compareVersions(b.version, a.version));
    cacheUpdateTime = now;
    return cache;
};

export const appVersion = (): string => {
    return app.getVersion();
};
