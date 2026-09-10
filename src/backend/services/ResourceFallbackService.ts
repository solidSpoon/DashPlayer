import { injectable } from 'inversify';
import { getMainLogger } from '@/backend/infrastructure/logger';
import type {
    FallbackFeature,
    FallbackTarget,
    ResourceFallbackSnapshot,
    ResourceFallbackState,
} from '@/common/contracts/resource-fallback';

/**
 * 回退状态的冷却时长。仅词典回退依据它短路：查词每次只查一个词，没有冷却的话
 * 云端不可用时每一次查词都会先等一次超时，回退反而让体验更差。
 *
 * 字幕翻译按批回退：失败的批次直接落到轻量翻译，下一批照常重试原引擎，
 * 不设冷却；字幕的回退状态只用于设置页展示。
 */
const FALLBACK_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * 记录各功能当前使用的资源档位与回退状态。
 *
 * 状态保存在内存里：它描述的是"此刻正在发生什么"，重启后自然清零，
 * 与持久化的用户配置无关。
 */
export default interface ResourceFallbackService {
    /** 该功能是否处于回退冷却中。 */
    isFallbackActive(feature: FallbackFeature): boolean;
    /** 读取该功能的回退状态；未回退（或冷却已结束）时为 null。 */
    getState(feature: FallbackFeature): ResourceFallbackState | null;
    /** 读取全部功能的回退状态，供设置页展示。 */
    getSnapshot(): ResourceFallbackSnapshot;
    /**
     * 登记一次回退并开启冷却窗口。
     *
     * @param feature 功能标识。
     * @param from 出问题的资源档位（引擎名或模型标识）。
     * @param to 实际落到的基础资源。
     * @param reason 失败原因，仅用于排查。
     */
    markFallback(feature: FallbackFeature, from: string, to: FallbackTarget, reason: string): void;
    /** 原资源恢复正常时清除该功能的回退状态。 */
    clear(feature: FallbackFeature): void;
}

@injectable()
export class ResourceFallbackServiceImpl implements ResourceFallbackService {
    private readonly logger = getMainLogger('ResourceFallback');
    private readonly states = new Map<FallbackFeature, ResourceFallbackState>();

    public isFallbackActive(feature: FallbackFeature): boolean {
        const state = this.states.get(feature);
        if (!state) {
            return false;
        }
        if (state.until <= Date.now()) {
            // 冷却结束：删掉记录，下次调用重新尝试原资源。
            this.states.delete(feature);
            this.logger.info('资源回退冷却结束，恢复尝试原资源', { feature });
            return false;
        }
        return true;
    }

    public getState(feature: FallbackFeature): ResourceFallbackState | null {
        return this.isFallbackActive(feature) ? this.states.get(feature) ?? null : null;
    }

    public getSnapshot(): ResourceFallbackSnapshot {
        return {
            subtitleTranslation: this.getState('subtitleTranslation'),
            dictionary: this.getState('dictionary'),
        };
    }

    public markFallback(feature: FallbackFeature, from: string, to: FallbackTarget, reason: string): void {
        const now = Date.now();
        const previous = this.states.get(feature);
        // 同一资源连续失败时只保留第一次，避免不断刷新冷却时间导致永远不再尝试
        if (previous && previous.from === from && previous.until > now) {
            return;
        }
        this.states.set(feature, {
            feature,
            from,
            to,
            reason,
            at: now,
            until: now + FALLBACK_COOLDOWN_MS,
        });
        this.logger.warn('资源不可用，已回退到基础资源', { feature, from, to, reason });
    }

    public clear(feature: FallbackFeature): void {
        if (this.states.delete(feature)) {
            this.logger.info('原资源恢复正常，清除回退状态', { feature });
        }
    }
}
