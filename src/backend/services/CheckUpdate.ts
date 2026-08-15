import axios, { AxiosResponse, isAxiosError } from 'axios';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { compareVersions } from 'compare-versions';
import Release from '@/common/types/release';
import { UpdateCheckResult } from '@/common/types/update-check';
import { app } from 'electron';

const UPDATE_CACHE_TTL_MS = 5 * 60 * 1000;
/** 限流失败缓存时长：GitHub 匿名限流窗口较长，失败后延长缓存避免在窗口内反复触发。 */
const RATE_LIMIT_FAILURE_CACHE_MS = 10 * 60 * 1000;
const RELEASES_BASE_URL = 'https://api.github.com/repos/solidSpoon/DashPlayer/releases';

let cache: UpdateCheckResult = { status: 'ok', releases: [] };
/** 缓存过期时间（绝对时间戳）：到期前直接返回缓存，避免重复请求。 */
let cacheExpireAt = 0;
/** 进行中的更新检查请求：并发调用共享同一请求，避免缓存过期瞬间多个调用同时打 GitHub。 */
let inflightRequest: Promise<UpdateCheckResult> | null = null;

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

/**
 * 检查 GitHub 是否有新版本。
 *
 * 行为说明：
 * - 缓存期内直接返回缓存，避免重复请求；
 * - 并发调用共享同一个进行中的请求，过期瞬间多个调用不会同时发起网络请求；
 * - 网络请求失败（含限流）会写入失败缓存：限流失败（403/429）缓存 10 分钟，其余失败缓存 5 分钟；
 * - 解析等意外异常会直接抛出、不写缓存，避免用错误数据掩盖问题。
 *
 * @returns 更新检查结果（含版本列表或错误信息）。
 */
export const checkUpdate = (): Promise<UpdateCheckResult> => {
    if (Date.now() < cacheExpireAt) {
        return Promise.resolve(cache);
    }
    if (!inflightRequest) {
        inflightRequest = doCheckUpdate().finally(() => {
            inflightRequest = null;
        });
    }
    return inflightRequest;
};

/**
 * 执行实际的更新检查请求并写入缓存；由 checkUpdate 保证同一时间只有一个实例在跑。
 *
 * 行为说明：
 * - /latest 请求失败（含 403 限流）直接返回失败缓存，不再请求列表接口；
 * - 列表接口失败时回退为仅返回 /latest 的单个版本；
 * - 所有正常与预期失败分支都会设置 cacheExpireAt，失败态同样缓存避免反复请求。
 *
 * @returns 更新检查结果。
 */
const doCheckUpdate = async (): Promise<UpdateCheckResult> => {
    const currentVersion = app.getVersion();
    const logger = getMainLogger('CheckUpdate');

    const latestRequestStart = Date.now();
    // catch 分支必然 return，能走到后续代码时 latestResponse 一定已成功赋值。
    let latestResponse!: AxiosResponse;
    try {
        latestResponse = await axios.get(`${RELEASES_BASE_URL}/latest`);
    } catch (err: unknown) {
        const costMs = Date.now() - latestRequestStart;
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const rateLimited = status === 403 || status === 429;
        // 限流/网络失败均为可恢复的预期失败，按 warn 记录并带上 status/耗时便于归因。
        logger.warn(rateLimited ? 'github latest release rate limited' : 'failed to fetch latest release', {
            status,
            url: `${RELEASES_BASE_URL}/latest`,
            costMs,
            error: err instanceof Error ? err.message : String(err),
        });
        cache = {
            status: 'error',
            releases: [],
            error: rateLimited ? 'github api rate limited' : 'failed to fetch latest release',
        };
        // 限流类失败延长缓存，避免在限流窗口内反复请求；失败态直接返回，避免被后续分支覆盖。
        cacheExpireAt = Date.now() + (rateLimited ? RATE_LIMIT_FAILURE_CACHE_MS : UPDATE_CACHE_TTL_MS);
        return cache;
    }

    // axios 默认仅放行 2xx；其余 2xx（如 204）按失败处理，避免解析空 body 抛错。
    if (latestResponse.status !== 200) {
        cache = { status: 'error', releases: [], error: `unexpected status ${latestResponse.status}` };
        cacheExpireAt = Date.now() + UPDATE_CACHE_TTL_MS;
        return cache;
    }

    const latestRelease = latestResponse.data as {
        html_url: string;
        tag_name: string;
        body: string;
        draft?: boolean;
        prerelease?: boolean;
    };

    // 显式校验关键字段，避免异常载荷被静默当作“无更新”缓存。
    if (!latestRelease || typeof latestRelease.tag_name !== 'string' || latestRelease.tag_name.length === 0) {
        logger.error('unexpected latest release payload', { status: latestResponse.status, url: `${RELEASES_BASE_URL}/latest` });
        cache = { status: 'error', releases: [], error: 'unexpected release payload' };
        cacheExpireAt = Date.now() + UPDATE_CACHE_TTL_MS;
        return cache;
    }

    if (!isStableRelease(latestRelease) || !isNewerVersion(latestRelease.tag_name, currentVersion)) {
        logger.debug('no new release available', {
            currentVersion,
            latestVersion: latestRelease.tag_name,
            costMs: Date.now() - latestRequestStart,
        });
        cache = { status: 'ok', releases: [] };
        cacheExpireAt = Date.now() + UPDATE_CACHE_TTL_MS;
        return cache;
    }

    const listRequestStart = Date.now();
    const listResponse = await axios
        .get(`${RELEASES_BASE_URL}?per_page=20`)
        .catch((err: unknown) => {
            logger.warn('failed to fetch releases', {
                status: isAxiosError(err) ? err.response?.status : undefined,
                url: `${RELEASES_BASE_URL}?per_page=20`,
                costMs: Date.now() - listRequestStart,
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        });

    if (listResponse?.status !== 200) {
        const fallback = toRelease(latestRelease);
        cache = { status: 'ok', releases: [fallback] };
        cacheExpireAt = Date.now() + UPDATE_CACHE_TTL_MS;
        return cache;
    }

    const releases: Release[] = listResponse.data
        .filter(isStableRelease)
        .map((release: { html_url: string; tag_name: string; body: string }) => toRelease(release))
        .filter((release: Release) => isNewerVersion(release.version, currentVersion))
        .sort(sortByVersionDesc);

    logger.info('fetched releases from github', { count: releases.length, costMs: Date.now() - latestRequestStart });
    cache = { status: 'ok', releases };
    cacheExpireAt = Date.now() + UPDATE_CACHE_TTL_MS;
    return cache;
};

export const appVersion = (): string => {
    return app.getVersion();
};
