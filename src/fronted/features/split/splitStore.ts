/**
 * 管理视频切分页面的文件输入、AI 格式化结果和切分任务执行状态。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { ChapterParseResult } from '@/common/types/chapter-result';
import { DpTaskState } from '@/common/contracts/dp-task';
import MediaUtil from '@/common/utils/MediaUtil';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import StrUtil from '@/common/utils/str-util';
import toast from 'react-hot-toast';
import { splitApi } from './splitApi';

/** 带有前端任务关联信息的章节解析结果。 */
export interface TaskChapterParseResult extends ChapterParseResult {
    /** 当前章节关联的任务编号，尚未执行时为 null。 */
    taskId: number | null;
}

/** 视频切分页面的输入和预览状态。 */
export type UseSplitState = {
    /** 待切分视频的绝对路径。 */
    videoPath: string | null;
    /** 可选字幕文件的绝对路径。 */
    srtPath: string | null;
    /** 用户输入或 AI 格式化后的章节文本。 */
    userInput: string;
    /** 当前章节预览结果。 */
    parseResult: TaskChapterParseResult[];
    /** 章节文本当前是否允许编辑。 */
    inputable: boolean;
};

/** 视频切分功能对页面暴露的操作。 */
export type UseSplitAction = {
    updateFile(filePath: string): void;
    setUseInput(input: string): void;
    deleteFile(filePath: string): void;
    runSplitAll(): Promise<void>;
    aiFormat: () => void;
};

const useSplit = create(
    persist(
        subscribeWithSelector<UseSplitState & UseSplitAction>((set, get) => ({
            videoPath: null,
            srtPath: null,
            userInput: '',
            parseResult: [],
            inputable: true,
            updateFile: async (filePath) => {
                if (StrUtil.isBlank(filePath)) {
                    return;
                }
                if (MediaUtil.isMedia(filePath)) {
                    set({ videoPath: filePath });
                }
                if (MediaUtil.isSubtitle(filePath)) {
                    set({ srtPath: filePath });
                }
                set({ parseResult: get().parseResult.map(r => ({ ...r, taskId: null })) });
            },
            setUseInput: (input) => {
                set({ userInput: input });
            },
            deleteFile: (filePath) => {
                if (get().videoPath === filePath) {
                    set({ videoPath: null });
                }
                if (get().srtPath === filePath) {
                    set({ srtPath: null });
                }
            },
            runSplitAll: async () => {
                const currentState = useSplit.getState();
                const videoPath = currentState.videoPath;
                if (!videoPath) {
                    throw new Error('Please select a video file first');
                }
                for (const chapter of get().parseResult) {
                    if (!chapter.timestampValid || StrUtil.isBlank(chapter.title)) {
                        throw new Error('请修正红色部分');
                    }
                }
                const folderName = await splitApi.splitVideo({
                    videoPath,
                    srtPath: currentState.srtPath,
                    chapters: currentState.parseResult
                });
                await splitApi.createWatchHistory([folderName]);
                await swrApiMutate('watch-history/list');
            },
            aiFormat: async () => {
                if (StrUtil.isBlank(get().userInput)) {
                    return;
                }
                const userInput = get().userInput;
                set({ inputable: false });
                // 流式打字机的节流窗口：partial 每个 chunk 都到，直接灌进输入框
                // 会让预览按同频走一次后端解析 IPC（正式环境曾因此刷屏报错）。
                const streamPaintIntervalMs = 300;
                let lastPaintedAt = 0;
                await useDpTaskCenter.getState().register(() => splitApi.formatSplit(userInput), {
                    // 流式中间态：把已生成的 formatedText 渐进填入输入框做打字机效果；
                    // 中间态是残缺 JSON/残缺文本，解析失败直接跳过等下一个 chunk，不报错。
                    onUpdated: (task) => {
                        const now = Date.now();
                        if (task.status !== DpTaskState.IN_PROGRESS || now - lastPaintedAt < streamPaintIntervalMs) {
                            return;
                        }
                        lastPaintedAt = now;
                        try {
                            const parsed = JSON.parse(task.result ?? '') as { formatedText?: string };
                            if (StrUtil.isNotBlank(parsed?.formatedText)) {
                                set({ userInput: parsed.formatedText });
                            }
                        } catch {
                            // partial 还没成 JSON 时静默跳过；最终结果以 onFinish 的校验结果为准。
                        }
                    },
                    onFinish: (task) => {
                        set({ inputable: true });
                        if (task.status !== DpTaskState.DONE) {
                            toast.error(task.progress ?? 'AI 整理失败');
                            return;
                        }
                        try {
                            const parsed = JSON.parse(task.result ?? '') as { formatedText?: string };
                            if (StrUtil.isBlank(parsed?.formatedText)) {
                                throw new Error('AI 返回结果缺少 formatedText 字段');
                            }
                            set({ userInput: parsed.formatedText });
                        } catch (error) {
                            splitLogger.error('AI 整理结果解析失败', { error });
                            toast.error('AI 整理结果无法解析，请重试');
                        }
                    },
                });
            }
        }))
        , {
            name: 'split-page-info'
        }
    )
);

useSplit.setState({
    inputable: true
});

// 用递增序号丢弃过期响应，避免旧预览覆盖用户最新输入。
let previewRequestSequence = 0;

const splitLogger = getRendererLogger('SplitStore');

useSplit.subscribe(
    (s) => s.userInput,
    async (topic) => {
        const requestSequence = ++previewRequestSequence;
        if (StrUtil.isBlank(topic)) {
            useSplit.setState({ parseResult: [] });
            return;
        }
        let result: ChapterParseResult[];
        try {
            result = await splitApi.previewSplit(topic);
        } catch (error) {
            // 用户正在逐字输入时（如只敲了半个时间戳）解析必然失败，
            // 属于预期中的瞬态：清空预览并留 warn 日志，而不是未处理拒绝刷屏。
            splitLogger.warn('章节预览解析失败，已清空预览', { error });
            if (requestSequence !== previewRequestSequence) {
                return;
            }
            useSplit.setState({ parseResult: [] });
            return;
        }
        if (requestSequence !== previewRequestSequence) {
            return;
        }
        const oldState: Map<string, TaskChapterParseResult> = new Map(useSplit.getState().parseResult.map(r => [r.original, r]));
        useSplit.setState({
            parseResult: result.map(r => ({
                ...r,
                taskId: oldState.get(r.original)?.taskId ?? null
            }))
        });
    }
);


export default useSplit;
