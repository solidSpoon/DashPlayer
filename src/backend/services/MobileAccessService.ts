import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inject, injectable } from 'inversify';

import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import MobileWebServer from '@/backend/infrastructure/mobile/MobileWebServer';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';
import MediaUtil from '@/common/utils/MediaUtil';
import {
    MobileAccessSettingDetailVO,
    MobileAccessSettingSaveVO,
} from '@/common/contracts/mobile-access-setting-vo';
import { MobileRecentItem, MobileSubtitleLine, MobileWatchDetail } from '@/common/contracts/mobile-web';
import type { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import type WatchHistoryService from '@/backend/services/WatchHistoryService';
import type SubtitleService from '@/backend/services/SubtitleService';
import type TranslateService from '@/backend/services/TranslateService';
import type MediaService from '@/backend/services/MediaService';
import type SubtitleTranslationService from '@/backend/services/subtitle-translation/SubtitleTranslationService';
import { buildSentenceStorageKey } from '@/backend/services/subtitle-translation/SubtitleTranslationCacheKey';

/** 最近播放列表最多返回的条数；手机页不需要加载完整历史。 */
const RECENT_LIMIT = 50;

/**
 * 手机访问设置与 HTTP 服务的生命周期。
 */
export default interface MobileAccessService {
    /**
     * 读取设置详情、运行状态和当前可用地址。
     *
     * @returns 设置页需要的完整状态；配置有问题时通过 `lastError` 显式暴露。
     */
    getDetail(): MobileAccessSettingDetailVO;

    /**
     * 保存设置并按需启动、重启或停止 HTTP 服务。
     *
     * 只有服务成功监听后才会写入设置；端口被占用等失败会抛给调用方，由设置页展示。
     *
     * @param settings 待保存的设置。
     */
    saveSettings(settings: MobileAccessSettingSaveVO): Promise<void>;

    /**
     * 按已持久化的设置启动服务；应用启动时调用。
     *
     * 启动失败只记录日志并写入 `lastError`，不阻塞应用启动。
     */
    startFromSettings(): Promise<void>;

    /**
     * 退出前停止监听。
     */
    shutdown(): Promise<void>;
}

/**
 * 去掉文件扩展名，用于最近播放列表的标题展示。
 *
 * @param fileName 文件名。
 * @returns 不含扩展名的文件名。
 */
const stripExtension = (fileName: string): string => {
    const extension = path.extname(fileName);
    return extension === '' ? fileName : fileName.slice(0, -extension.length);
};

/**
 * 判断端口是否为合法整数。
 *
 * @param port 待校验端口。
 * @returns 在 1-65535 范围内时为 true。
 */
const isValidPort = (port: number): boolean => {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
};

/**
 * 校验端口是否为合法整数。
 *
 * @param port 待校验端口。
 * @throws 不在 1-65535 范围内时抛出。
 */
const assertValidPort = (port: number): void => {
    if (!isValidPort(port)) {
        throw new Error('端口需在 1-65535 之间');
    }
};

/**
 * 收集本机所有可用的 IPv4 局域网地址。
 *
 * 过滤回环、链路本地和重复项；虚拟网卡地址也会保留，由用户自行选择能连通的那个。
 *
 * @param port 当前监听端口。
 * @returns 形如 http://192.168.1.2:8765 的地址列表。
 */
const collectLanUrls = (port: number): string[] => {
    const urls = new Set<string>();
    for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses ?? []) {
            if (address.family !== 'IPv4' || address.internal) {
                continue;
            }
            if (address.address.startsWith('169.254.')) {
                continue;
            }
            urls.add(`http://${address.address}:${port}`);
        }
    }
    return [...urls];
};

/**
 * 管理手机访问设置和手机页 HTTP 服务。
 */
@injectable()
export class MobileAccessServiceImpl implements MobileAccessService {
    private readonly logger = getMainLogger('MobileAccessServiceImpl');
    private readonly settingsStore: SettingsStore;
    private readonly watchHistoryService: WatchHistoryService;
    private readonly subtitleService: SubtitleService;
    private readonly translateService: TranslateService;
    private readonly mediaService: MediaService;
    private readonly subtitleTranslationService: SubtitleTranslationService;

    /** 正在运行的服务；null 表示没有监听。 */
    private server: MobileWebServer | null = null;
    /** 当前实际监听的端口；服务未运行时为 null。 */
    private serverPort: number | null = null;
    /** 最近一次启动失败的原因，供设置页展示。 */
    private lastError: string | null = null;

    /**
     * 创建手机访问服务。
     *
     * @param settingsStore 设置读写入口。
     * @param watchHistoryService 观看历史与播放源解析。
     * @param subtitleService 字幕解析。
     * @param translateService 单词查词。
     * @param mediaService 视频大图生成。
     * @param subtitleTranslationService 字幕批量翻译。
     */
    public constructor(
        @inject(TYPES.SettingsStore) settingsStore: SettingsStore,
        @inject(TYPES.WatchHistoryService) watchHistoryService: WatchHistoryService,
        @inject(TYPES.SubtitleService) subtitleService: SubtitleService,
        @inject(TYPES.TranslateService) translateService: TranslateService,
        @inject(TYPES.MediaService) mediaService: MediaService,
        @inject(TYPES.SubtitleTranslationService) subtitleTranslationService: SubtitleTranslationService,
    ) {
        this.settingsStore = settingsStore;
        this.watchHistoryService = watchHistoryService;
        this.subtitleService = subtitleService;
        this.translateService = translateService;
        this.mediaService = mediaService;
        this.subtitleTranslationService = subtitleTranslationService;
    }

    /** {@inheritDoc MobileAccessService.getDetail} */
    public getDetail(): MobileAccessSettingDetailVO {
        const settings = this.readSettings();
        const runningPort = this.server !== null ? this.serverPort : null;
        const running = runningPort !== null;
        const port = runningPort ?? settings.port;
        return {
            enabled: settings.enabled,
            port,
            running,
            lanUrls: running ? collectLanUrls(port) : [],
            lastError: this.lastError ?? settings.error,
        };
    }

    /** {@inheritDoc MobileAccessService.saveSettings} */
    public async saveSettings(settings: MobileAccessSettingSaveVO): Promise<void> {
        if (!settings.enabled) {
            // 关闭优先：端口填错了也不该拦着用户停服务。
            await this.stopServer();
            this.settingsStore.set('mobileAccess.enabled', 'false');
            if (isValidPort(settings.port)) {
                this.settingsStore.set('mobileAccess.port', String(settings.port));
            }
            this.lastError = null;
            return;
        }

        assertValidPort(settings.port);
        if (this.server === null || this.serverPort !== settings.port) {
            await this.restartServer(settings.port);
        }

        this.settingsStore.set('mobileAccess.enabled', 'true');
        this.settingsStore.set('mobileAccess.port', String(settings.port));
        this.lastError = null;
    }

    /** {@inheritDoc MobileAccessService.startFromSettings} */
    public async startFromSettings(): Promise<void> {
        const settings = this.readSettings();
        if (settings.error !== null) {
            this.lastError = settings.error;
            this.logger.warn('mobile access settings invalid', { error: settings.error });
            return;
        }
        if (!settings.enabled || this.server !== null) {
            return;
        }

        try {
            await this.startServer(settings.port);
            this.lastError = null;
            this.logger.info('mobile access started from settings', { port: settings.port });
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.logger.error('failed to start mobile access', {
                port: settings.port,
                error: this.lastError,
            });
        }
    }

    /** {@inheritDoc MobileAccessService.shutdown} */
    public async shutdown(): Promise<void> {
        await this.stopServer();
    }

    /**
     * 读取并校验持久化设置。
     *
     * 配置损坏时不抛错，而是把问题放进 `error` 并由设置页展示，
     * 这样用户还能在页面里改回合法端口；启动流程也不会因为一个坏值崩掉。
     *
     * @returns 设置值与配置问题。
     */
    private readSettings(): { enabled: boolean; port: number; error: string | null } {
        const rawEnabled = this.settingsStore.get('mobileAccess.enabled');
        const rawPort = this.settingsStore.get('mobileAccess.port');

        let error: string | null = null;
        if (rawEnabled !== 'true' && rawEnabled !== 'false') {
            error = `手机访问开关配置非法：${rawEnabled}`;
        }

        const parsedPort = Number(rawPort);
        const portValid = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;
        if (!portValid) {
            error = `手机访问端口配置非法：${rawPort}`;
        }

        return {
            enabled: rawEnabled === 'true',
            port: portValid ? parsedPort : 0,
            error,
        };
    }

    /**
     * 创建并启动服务实例。
     *
     * @param port 监听端口。
     */
    private async startServer(port: number): Promise<void> {
        const staticDirectory = getRuntimeResourcePath('resources', 'mobile');
        // 构建产物缺失是打包/安装问题，直接失败让设置页显式报错，不要起一个打不开的服务。
        const indexFile = path.join(staticDirectory, 'index.html');
        if (!fs.existsSync(indexFile)) {
            throw new Error(`手机页资源缺失：${indexFile}`);
        }

        const server = new MobileWebServer({
            staticDirectory,
            source: {
                listRecent: () => this.listRecent(),
                getWatchDetail: (id) => this.getWatchDetail(id),
                resolveVideoFile: (id) => this.watchHistoryService.videoPath(id),
                getThumbnail: (id) => this.getThumbnail(id),
                saveProgress: (id, position) => this.saveProgress(id, position),
                lookupWord: (word) => this.translateService.transWord(word),
                translateTexts: (texts) => this.translateTexts(texts),
            },
        });
        await server.start(port);
        this.server = server;
        this.serverPort = port;
    }

    /**
     * 停止当前服务；没有运行时直接返回。
     */
    private async stopServer(): Promise<void> {
        const server = this.server;
        this.server = null;
        this.serverPort = null;
        if (server !== null) {
            await server.stop();
        }
    }

    /**
     * 切换监听端口。
     *
     * 新端口起不来时尝试把旧端口恢复回来，避免一次改错让手机页整体不可用；
     * 无论恢复是否成功都会把新端口的失败原因抛给设置页。
     *
     * @param port 目标端口。
     */
    private async restartServer(port: number): Promise<void> {
        const previousPort = this.serverPort;
        await this.stopServer();
        try {
            await this.startServer(port);
            this.lastError = null;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.lastError = message;
            if (previousPort !== null) {
                try {
                    await this.startServer(previousPort);
                } catch (restoreError) {
                    this.logger.error('failed to restore previous mobile access port', {
                        port: previousPort,
                        error: restoreError,
                    });
                }
            }
            throw new Error(`端口 ${port} 启动失败：${message}`);
        }
    }

    /**
     * 读取最近播放列表。
     *
     * @returns 按最近观看时间倒序的列表，最多 RECENT_LIMIT 条。
     */
    private async listRecent(): Promise<MobileRecentItem[]> {
        const histories = await this.watchHistoryService.listBasic('');
        return histories.slice(0, RECENT_LIMIT).map((history) => {
            const displayName = history.displayFileName ?? history.fileName;
            const fileName = stripExtension(displayName);
            const folderName = path.basename(history.basePath);
            return {
                id: history.id,
                title: history.isFolder ? folderName : fileName,
                subtitle: history.isFolder ? fileName : folderName,
                isFolder: history.isFolder,
                isAudio: MediaUtil.isAudio(displayName),
                updatedAt: history.updatedAt.toISOString(),
                position: history.current_position,
                thumbnailUrl: `/api/videos/${encodeURIComponent(history.id)}/thumb`,
            };
        });
    }

    /**
     * 生成或读取观看记录的大图。
     *
     * 使用视频中点附近的一帧，保证同一个文件始终对应同一张缓存图；手机端只取
     * 800px 宽的 JPG，够列表展示又不会让 ffmpeg 生成过大的图片。
     *
     * @param id 观看记录 ID。
     * @returns 缩略图文件的绝对路径。
     */
    private async getThumbnail(id: string): Promise<string> {
        const filePath = await this.watchHistoryService.videoPath(id);
        return this.mediaService.thumbnail(filePath, undefined, {
            quality: 'medium',
            width: 800,
            format: 'jpg',
        });
    }

    /**
     * 批量翻译字幕行。
     *
     * 直接用现有的字幕翻译服务，命中缓存时不会再次请求模型；返回结果按入参顺序
     * 排列，空行保持空字符串。
     *
     * @param texts 待翻译的字幕文本。
     * @returns 与入参顺序一致的译文。
     */
    private async translateTexts(texts: string[]): Promise<string[]> {
        const normalized = texts.map((text) => text.trim());
        const unique = Array.from(new Set(normalized.filter((text) => text !== '')));
        if (unique.length === 0) {
            return normalized.map(() => '');
        }

        const result = await this.subtitleTranslationService.translateTexts(unique);
        const byText = new Map<string, string>();
        for (const text of unique) {
            byText.set(text, result.get(buildSentenceStorageKey(text)) ?? '');
        }
        return normalized.map((text) => (text === '' ? '' : byText.get(text) ?? ''));
    }

    /**
     * 读取手机播放页所需的详情与字幕。
     *
     * @param id 观看记录 ID。
     * @returns 播放详情；字幕文件不存在或没有字幕时 `subtitles` 为空数组。
     */
    private async getWatchDetail(id: string): Promise<MobileWatchDetail> {
        const detail = await this.watchHistoryService.basicDetail(id);
        if (detail === null) {
            throw new Error(`观看记录不存在：${id}`);
        }

        const subtitle = await this.watchHistoryService.playerSubtitle(id);
        let subtitles: MobileSubtitleLine[] = [];
        if (subtitle.subtitlePath !== '') {
            const parsed = await this.subtitleService.parseSrt(subtitle.subtitlePath);
            subtitles = parsed.sentences.map((sentence) => ({
                start: sentence.adjustedStart ?? sentence.start,
                end: sentence.adjustedEnd ?? sentence.end,
                en: sentence.text,
                zh: sentence.textZH,
            }));
        }

        const displayName = detail.displayFileName ?? detail.fileName;
        const fileName = stripExtension(displayName);
        const folderName = path.basename(detail.basePath);
        return {
            id: detail.id,
            title: detail.isFolder ? folderName : fileName,
            subtitle: detail.isFolder ? fileName : folderName,
            isAudio: MediaUtil.isAudio(displayName),
            streamUrl: `/api/videos/${encodeURIComponent(detail.id)}/stream`,
            currentPosition: detail.current_position,
            subtitles,
            subtitleMismatchSuspected: subtitle.mismatchSuspected,
        };
    }

    /**
     * 把手机端播放位置写回观看历史。
     *
     * @param id 观看记录 ID。
     * @param position 播放位置，单位秒。
     */
    private async saveProgress(id: string, position: number): Promise<void> {
        const filePath = await this.watchHistoryService.videoPath(id);
        await this.watchHistoryService.updateProgress(filePath, Math.floor(position));
    }
}
