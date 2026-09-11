import { inject, injectable } from 'inversify';

import { LearnedCapabilityOverlay, PlaybackEvidenceInput } from '@/common/contracts/playback-repair';
import { getMainLogger } from '@/backend/infrastructure/logger';
import SysConfRepository from '@/backend/services/repositories/SysConfRepository';
import TYPES from '@/backend/ioc/types';
import TimeUtil from '@/common/utils/TimeUtil';

/** dp_sys_conf 中的存储键；缓存结构不兼容时换键即可整体放弃旧数据。 */
export const PLAYBACK_CAPABILITY_CACHE_KEY = 'playback.capabilities.v1';

/** 缓存结构版本；字段形状变化时递增，读取到不一致版本时按空缓存处理。 */
const CACHE_SCHEMA_VERSION = 1;

/**
 * 单个编码的实测结论条目。
 *
 * 学习层只记录编码级的二值结论：正面结论（playable）仅用于避免重复探测，
 * 负面结论（unplayable）会让诊断收紧修复配方。
 */
interface CapabilityEntry {
    /** 实测结论。 */
    verdict: 'playable' | 'unplayable';
    /** 支撑该结论的证据票数；保留字段，将来若需要把负面结论改成多票制可直接复用。 */
    votes: number;
    /** 产生证据的源文件路径，最多保留最近两条，便于排障与同源去重。 */
    sources: string[];
    /** 最近一次证据时间，UTC 格式。 */
    updatedAt: string;
}

/** dp_sys_conf 中缓存值的结构。 */
interface CapabilityCacheFile {
    /** 缓存结构版本。 */
    schemaVersion: number;
    /** 采集证据时的 Electron 版本；升级后条目全部作废，重新学习。 */
    electronVersion: string;
    /** 编码名（小写）→ 结论。 */
    entries: Record<string, CapabilityEntry>;
}

/**
 * 播放能力学习缓存的业务契约。
 *
 * 静态编码白名单按作者的开发机实测维护，跨平台必然存在误判（如无硬解机器上的 HEVC）。
 * 本服务把真机播放证据沉淀成机器级缓存，诊断时叠加在静态白名单之上，
 * 把「跨平台白名单误判」从已声明的取舍变成自愈机制。
 */
export default interface PlaybackCapabilityService {
    /**
     * 查询诊断用的学习覆盖层。
     *
     * 只返回「实测不可解」的结论：正面结论不影响诊断（静态白名单本来就是能播）。
     *
     * @param videoCodec 待诊断的视频编码；无视频流时传空。
     * @param audioCodec 待诊断的音频编码；无音轨时传空。
     * @returns 覆盖层；没有任何学习结论时字段缺省。
     */
    getOverlay(videoCodec?: string, audioCodec?: string): Promise<LearnedCapabilityOverlay>;

    /**
     * 查询是否还需要对这两个编码做真机探测。
     *
     * 探测成本不为零（约 1.6s 隐藏试播），只在「从未有过结论」时返回 true，
     * 保证每个编码每台机器最多探测一次。
     *
     * @param videoCodec 待探测的视频编码；无则传空。
     * @param audioCodec 待探测的音频编码；无则传空。
     * @returns 至少一个编码没有任何结论时返回 true。
     */
    shouldProbeCapability(videoCodec?: string | null, audioCodec?: string | null): Promise<boolean>;

    /**
     * 记录一次结论性播放证据。
     *
     * 非结论性证据（试播没跑起来、计数不可信）会被忽略，不下任何结论。
     * 负面证据覆盖正面结论：宁可让修复更保守，也不放行黑屏/无声的源。
     *
     * @param input 渲染端上报的证据。
     */
    recordEvidence(input: PlaybackEvidenceInput): Promise<void>;
}

/**
 * 播放能力学习缓存的默认实现。
 *
 * 数据落在 dp_sys_conf 的单个键里（JSON 快照），低频读写，不做内存缓存：
 * 每次诊断多一次主键查询，换来无需处理进程内缓存与数据库的一致性。
 */
@injectable()
export class PlaybackCapabilityServiceImpl implements PlaybackCapabilityService {
    private readonly logger = getMainLogger('PlaybackCapabilityService');

    /**
     * 创建播放能力学习缓存服务。
     * @param sysConfRepository 系统配置键值存储。
     */
    constructor(
        @inject(TYPES.SysConfRepository) private readonly sysConfRepository: SysConfRepository,
    ) {}

    /** @inheritdoc */
    public async getOverlay(videoCodec?: string, audioCodec?: string): Promise<LearnedCapabilityOverlay> {
        const { entries } = await this.loadCache();
        const overlay: LearnedCapabilityOverlay = {};
        const unplayable = (codec?: string): boolean =>
            typeof codec === 'string' && codec.length > 0 && entries[codec.toLowerCase()]?.verdict === 'unplayable';
        if (unplayable(videoCodec)) {
            overlay.video = 'unplayable';
        }
        if (unplayable(audioCodec)) {
            overlay.audio = 'unplayable';
        }
        return overlay;
    }

    /** @inheritdoc */
    public async shouldProbeCapability(
        videoCodec?: string | null,
        audioCodec?: string | null,
    ): Promise<boolean> {
        const { entries } = await this.loadCache();
        const missing = (codec?: string | null): boolean =>
            typeof codec === 'string' && codec.length > 0 && entries[codec.toLowerCase()] === undefined;
        return missing(videoCodec) || missing(audioCodec);
    }

    /** @inheritdoc */
    public async recordEvidence(input: PlaybackEvidenceInput): Promise<void> {
        const codec = input.codec.trim().toLowerCase();
        if (codec.length === 0) {
            return;
        }
        if (!input.conclusive) {
            // 试播没跑起来时计数不可信：不下任何结论，也不缓存。
            this.logger.debug('忽略非结论性播放证据', { codec: input.codec, kind: input.kind });
            return;
        }

        const file = await this.loadCache();
        const existing = file.entries[codec];
        if (input.playable) {
            if (existing?.verdict === 'unplayable') {
                // 已定谳「不可解」的编码不被单次正面证据翻案：学习层只收紧不放松；
                // Electron 升级后条目整体作废，会重新学习。
                this.logger.info('编码已有不可解结论，忽略正面证据', { codec });
                return;
            }
            if (existing?.verdict === 'playable') {
                return;
            }
        }

        file.entries[codec] = {
            verdict: input.playable ? 'playable' : 'unplayable',
            votes: 1,
            sources: this.mergeSources(existing?.sources, input.sourceFile),
            updatedAt: TimeUtil.timeUtc(),
        };
        await this.saveCache(file);
        this.logger.info('记录播放能力证据', {
            codec,
            kind: input.kind,
            playable: input.playable,
            sourceFile: input.sourceFile,
        });
    }

    /**
     * 读取缓存快照；键不存在、结构版本不一致或 Electron 版本变化时返回空缓存。
     *
     * 缓存是可再生的派生数据：JSON 损坏时按「无学习数据」重建并显式记错误日志，
     * 不让诊断链路因此失败。
     */
    private async loadCache(): Promise<CapabilityCacheFile> {
        const raw = await this.sysConfRepository.getValue(PLAYBACK_CAPABILITY_CACHE_KEY);
        if (raw === null || raw === '') {
            return createEmptyCacheFile(this.getCurrentElectronVersion());
        }

        let parsed: CapabilityCacheFile;
        try {
            parsed = JSON.parse(raw) as CapabilityCacheFile;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('播放能力缓存损坏，重置为空缓存', { error: message });
            const fresh = createEmptyCacheFile(this.getCurrentElectronVersion());
            await this.saveCache(fresh);
            return fresh;
        }

        if (
            parsed?.schemaVersion !== CACHE_SCHEMA_VERSION
            || parsed?.electronVersion !== this.getCurrentElectronVersion()
            || typeof parsed.entries !== 'object'
            || parsed.entries === null
        ) {
            // Electron 升级或结构变更后全部作废；不立即写盘，等下一次证据写入时自然覆盖。
            return createEmptyCacheFile(this.getCurrentElectronVersion());
        }
        return parsed;
    }

    /**
     * 写回缓存快照。
     * @param file 最新缓存内容。
     */
    private async saveCache(file: CapabilityCacheFile): Promise<void> {
        await this.sysConfRepository.setValue(PLAYBACK_CAPABILITY_CACHE_KEY, JSON.stringify(file));
    }

    /**
     * 合并证据来源列表，最多保留最近两条。
     *
     * @param sources 既有来源。
     * @param sourceFile 新证据来源。
     * @returns 去重后的来源列表。
     */
    private mergeSources(sources: string[] | undefined, sourceFile: string): string[] {
        const merged = [...(sources ?? []).filter((item) => item !== sourceFile), sourceFile];
        return merged.slice(-2);
    }

    /**
     * 当前 Electron 版本；绑定到缓存条目，升级后条目作废重新学习。
     *
     * protected 以便测试模拟版本升级。
     */
    protected getCurrentElectronVersion(): string {
        return process.versions.electron ?? 'unknown';
    }
}

/**
 * 创建一份空缓存快照。
 * @param electronVersion 当前 Electron 版本。
 * @returns 空缓存。
 */
function createEmptyCacheFile(electronVersion: string): CapabilityCacheFile {
    return { schemaVersion: CACHE_SCHEMA_VERSION, electronVersion, entries: {} };
}
