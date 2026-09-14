/**
 * 为设置页表单提供防抖自动保存、初始化基线和串行提交能力。
 */
import * as React from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { showNotification } from '@/fronted/components/shared/toasts/notification';

/**
 * 自动保存状态。
 */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 自动保存 Hook 的入参。
 */
export interface UseAutoSaveSettingsFormOptions<TFormValues extends FieldValues> {
    /** React Hook Form 实例。 */
    form: UseFormReturn<TFormValues>;
    /** 执行保存请求的方法。 */
    onSave: (values: TFormValues) => Promise<void>;
    /** 防抖延迟，单位毫秒。 */
    debounceMs?: number;
    /** 本页详情数据的 SWR 缓存键；保存成功后据此刷新缓存，见 hook 内的说明。 */
    detailKey?: string;
}

/**
 * 自动保存 Hook 的返回值。
 */
export interface UseAutoSaveSettingsFormResult<TFormValues extends FieldValues> {
    /** 当前自动保存状态。 */
    status: AutoSaveStatus;
    /** 最近一次错误消息。 */
    error: string | null;
    /** 是否已完成服务端数据初始化。 */
    ready: boolean;
    /** 使用服务端详情初始化表单并建立基线快照。 */
    initialize: (values: TFormValues) => void;
    /** 立即保存当前值（跳过防抖）。 */
    flush: () => Promise<void>;
}

/**
 * 将表单值序列化为稳定快照，用于判断是否有未保存变更。
 */
function snapshotOf<TFormValues extends FieldValues>(values: TFormValues): string {
    return JSON.stringify(values);
}

/**
 * 提供“后端详情为唯一事实源”的自动保存能力。
 *
 * 核心原则：
 * - 仅在 `initialize` 后才允许自动保存；
 * - 保存串行执行，新的变更会排队到下一轮；
 * - 失败时不覆盖用户输入，保留脏状态并暴露错误。
 */
export function useAutoSaveSettingsForm<TFormValues extends FieldValues>(
    options: UseAutoSaveSettingsFormOptions<TFormValues>,
): UseAutoSaveSettingsFormResult<TFormValues> {
    const { form, onSave, debounceMs = 600, detailKey } = options;
    const { getValues, reset, watch } = form;
    const { t } = useI18nTranslation('settings');
    const { mutate } = useSWRConfig();

    const [ready, setReady] = React.useState(false);
    const [status, setStatus] = React.useState<AutoSaveStatus>('idle');
    const [error, setError] = React.useState<string | null>(null);

    const baselineSnapshotRef = React.useRef<string | null>(null);
    const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveInFlightRef = React.useRef(false);
    const saveQueuedRef = React.useRef(false);
    const commitRef = React.useRef<() => Promise<void>>(async () => undefined);
    const idleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * 将状态从 saved 回落到 idle，避免 UI 一直停留在“已保存”。
     */
    const scheduleIdleStatus = React.useCallback(() => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
        idleTimerRef.current = setTimeout(() => {
            setStatus((previous) => (previous === 'saved' ? 'idle' : previous));
        }, 1500);
    }, []);

    /**
     * 实际执行一次保存；若存在并发请求则排队下一轮。
     */
    const commit = React.useCallback(async (): Promise<void> => {
        if (!ready) {
            return;
        }

        const latestValues = getValues();
        const latestSnapshot = snapshotOf(latestValues);
        if (latestSnapshot === baselineSnapshotRef.current) {
            return;
        }

        if (saveInFlightRef.current) {
            saveQueuedRef.current = true;
            return;
        }

        saveInFlightRef.current = true;
        setStatus('saving');
        setError(null);
        let thrownError: unknown = null;
        let shouldCommitAgain = false;

        try {
            await onSave(latestValues);
            // 保存成功后详情缓存已被写脏，必须立刻刷新它：SWR 在一次请求结束后会在
            // dedupingInterval（默认 2 秒）内保留「请求进行中」标记，此时重新进入该页
            // 会被判定为无需重拉，于是页面一直显示旧值——用户核对时会以为没保存成功。
            // 失败不影响保存结果本身，这里只吞掉错误交给下次进入页面时重拉。
            if (detailKey) {
                void mutate(detailKey).catch(() => undefined);
            }
            baselineSnapshotRef.current = latestSnapshot;
            setStatus('saved');
            scheduleIdleStatus();
        } catch (saveError) {
            setStatus('error');
            setError(saveError instanceof Error ? saveError.message : String(saveError));
            thrownError = saveError;
        } finally {
            saveInFlightRef.current = false;
            if (saveQueuedRef.current) {
                saveQueuedRef.current = false;
                shouldCommitAgain = true;
            }
        }
        if (shouldCommitAgain) {
            await commitRef.current();
            return;
        }
        if (thrownError) {
            throw thrownError;
        }
    }, [detailKey, getValues, mutate, onSave, ready, scheduleIdleStatus]);

    React.useEffect(() => {
        commitRef.current = commit;
    }, [commit]);

    /**
     * 用后端详情重置表单，并建立新的保存基线。
     */
    const initialize = React.useCallback((values: TFormValues) => {
        const nextSnapshot = snapshotOf(values);
        baselineSnapshotRef.current = nextSnapshot;
        reset(values);
        setReady(true);
        setStatus('idle');
        setError(null);
    }, [reset]);

    /**
     * 手动触发保存并等待完成。
     */
    const flush = React.useCallback(async () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        await commit();
    }, [commit]);

    React.useEffect(() => {
        const subscription = watch(() => {
            if (!ready) {
                return;
            }
            const latestSnapshot = snapshotOf(getValues());
            if (latestSnapshot === baselineSnapshotRef.current) {
                return;
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
                commit().catch(() => undefined);
            }, debounceMs);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [commit, debounceMs, getValues, ready, watch]);

    React.useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
            // 用户在防抖窗口内切走（换设置栏目、离开设置中心）时，上面只是清掉了定时器，
            // 挂起的改动会就此丢失——所以这里补一次提交。commit 在无改动时提前返回，
            // 正常导航没有额外开销；此时页面已卸载、内联横幅无从展示，失败改用全局提示露出。
            commitRef.current().catch((saveError) => {
                showNotification({
                    variant: 'error',
                    title: t('common.saveFailed'),
                    message: saveError instanceof Error ? saveError.message : String(saveError),
                });
            });
        };
    }, [t]);

    return {
        status,
        error,
        ready,
        initialize,
        flush,
    };
}
