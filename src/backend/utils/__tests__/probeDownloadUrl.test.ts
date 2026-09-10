import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { probeReachableDownloadUrl } from '@/backend/utils/probeDownloadUrl';

const OFFICIAL_URL = 'https://official.example.com/model.bin';
const MIRROR_URL = 'https://mirror.example.com/model.bin';

/** 将 axios.head 打桩为按清单决定地址可达性，未列入清单的地址视为网络不可达。 */
function mockHeadReachability(reachableUrls: string[]): void {
    vi.spyOn(axios, 'head').mockImplementation(async (url: string) => {
        if (!reachableUrls.includes(url)) {
            throw new Error('connection refused');
        }
        return { status: 200, statusText: 'OK', headers: {}, data: undefined, config: {} } as never;
    });
}

describe('下载地址可达性探测', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('官方与镜像都可达时返回官方地址（声明顺序优先）', async () => {
        mockHeadReachability([OFFICIAL_URL, MIRROR_URL]);

        const result = await probeReachableDownloadUrl([OFFICIAL_URL, MIRROR_URL], new AbortController().signal);

        expect(result).toBe(OFFICIAL_URL);
    });

    it('官方不可达时返回镜像地址', async () => {
        mockHeadReachability([MIRROR_URL]);

        const result = await probeReachableDownloadUrl([OFFICIAL_URL, MIRROR_URL], new AbortController().signal);

        expect(result).toBe(MIRROR_URL);
    });

    it('全部地址不可达时返回 null', async () => {
        mockHeadReachability([]);

        const result = await probeReachableDownloadUrl([OFFICIAL_URL, MIRROR_URL], new AbortController().signal);

        expect(result).toBeNull();
    });

    it('单个地址探测被取消时视为不可达并返回 null', async () => {
        // 模拟探测请求已发出但随后被取消：axios 收到中止信号后以 reject 结束
        const controller = new AbortController();
        vi.spyOn(axios, 'head').mockImplementation(async () => {
            controller.abort();
            return Promise.reject(new Error('canceled'));
        });

        const result = await probeReachableDownloadUrl([OFFICIAL_URL], controller.signal);

        expect(result).toBeNull();
    });
});
