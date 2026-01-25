import axios from 'axios';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { compareVersions } from 'compare-versions';
import Release from '@/common/types/release';
import { UpdateCheckResult } from '@/common/types/update-check';
import { app } from 'electron';

const UPDATE_CACHE_TTL_MS = 5 * 60 * 1000;
const RELEASES_BASE_URL = 'https://api.github.com/repos/solidSpoon/DashPlayer/releases';

let cache: UpdateCheckResult = { status: 'ok', releases: [] };
let cacheUpdateTime = 0;

const normalizeVersion = (version: string) => version.trim().replace(/^v/i, '');

const isNewerVersion = (version: string, currentVersion: string) => {
    try {
        return compareVersions(normalizeVersion(version), normalizeVersion(currentVersion)) > 0;
    } catch (error) {
        return false;
    }
};

const sortByVersionDesc = (a: Release, b: Release) => {
    try {
        return compareVersions(normalizeVersion(b.version), normalizeVersion(a.version));
    } catch (error) {
        return 0;
    }
};

const toRelease = (release: { html_url: string; tag_name: string; body: string }): Release => ({
    url: release.html_url,
    version: release.tag_name,
    content: release.body,
});

const isStableRelease = (release: { draft?: boolean; prerelease?: boolean }) => {
    return !release.draft && !release.prerelease;
};

export const checkUpdate = async (): Promise<UpdateCheckResult> => {
    const now = Date.now();
    // 5分钟内不重复检查更新
    if (now - cacheUpdateTime < UPDATE_CACHE_TTL_MS) {
        return cache;
    }

    const currentVersion = app.getVersion();
    const logger = getMainLogger('CheckUpdate');

    const latestResponse = await axios
        .get(`${RELEASES_BASE_URL}/latest`)
        .catch((err) => {
            logger.error('failed to fetch latest release', { error: err.message });
            return null;
        });

    if (latestResponse?.status !== 200) {
        cache = { status: 'error', releases: [], error: 'failed to fetch latest release' };
        cacheUpdateTime = now;
        return cache;
    }

    const latestRelease = latestResponse.data as {
        html_url: string;
        tag_name: string;
        body: string;
        draft?: boolean;
        prerelease?: boolean;
    };

    if (!isStableRelease(latestRelease) || !isNewerVersion(latestRelease.tag_name, currentVersion)) {
        cache = { status: 'ok', releases: [] };
        cacheUpdateTime = now;
        return cache;
    }

    const listResponse = await axios
        .get(`${RELEASES_BASE_URL}?per_page=20`)
        .catch((err) => {
            logger.error('failed to fetch releases', { error: err.message });
            return null;
        });

    if (listResponse?.status !== 200) {
        const fallback = toRelease(latestRelease);
        cache = { status: 'ok', releases: [fallback] };
        cacheUpdateTime = now;
        return cache;
    }

    const releases: Release[] = listResponse.data
        .filter(isStableRelease)
        .map((release: { html_url: string; tag_name: string; body: string }) => toRelease(release))
        .filter(release => isNewerVersion(release.version, currentVersion))
        .sort(sortByVersionDesc);

    logger.info('fetched releases from github', { count: releases.length });
    cache = { status: 'ok', releases };
    cacheUpdateTime = now;
    return cache;
};

export const appVersion = (): string => {
    return app.getVersion();
};
