import React from 'react';
import TranscriptFile from './components/TranscriptFile';
import TranscriptTable from './components/TranscriptTable';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { transcriptApi } from './transcriptApi';
import { Badge } from '@/fronted/components/ui/badge';

/** 展示转录文件浏览区与任务队列。 */
const TranscriptPage = () => {
    const { t } = useI18nTranslation('pages');
    const { data: tasks = [], error, mutate } = useSWR(
        SWR_KEY.TRANSCRIPTION_TASKS,
        transcriptApi.listTasks,
    );
    if (error) {
        throw error;
    }

    /**
     * 将视频加入后端任务表，并立即刷新列表。
     *
     * @param filePath 视频绝对路径。
     */
    const enqueue = async (filePath: string): Promise<void> => {
        await transcriptApi.enqueueTask(filePath);
        await mutate();
    };

    /**
     * 启动后端转录，并刷新任务状态。
     *
     * @param filePath 视频绝对路径。
     * @returns 后端启动结果。
     */
    const start = async (filePath: string): Promise<'started' | 'model_missing'> => {
        const result = await transcriptApi.startTranscription(filePath);
        await mutate();
        return result;
    };

    /**
     * 从后端任务表删除视频，并刷新列表。
     *
     * @param filePath 视频绝对路径。
     */
    const remove = async (filePath: string): Promise<void> => {
        await transcriptApi.removeTask(filePath);
        await mutate();
    };

    const activeTasksCount = tasks.filter(
        (task) => task.status === 'in_progress' || task.status === 'init',
    ).length;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            {/* 顶栏标题区：保持现代无分割线设计 */}
            <div className="px-6 pt-5 pb-2">
                <PageHeader
                    title={t('subtitleWorkspace.title')}
                    description={t('subtitleWorkspace.description')}
                />
            </div>

            {/* 内容区：左侧 460px~520px 宽资源选择，右侧自适应任务列表 */}
            <div className="flex-1 min-h-0 flex gap-5 px-6 pb-5 pt-1 overflow-hidden">
                <div className="w-[460px] xl:w-[500px] 2xl:w-[540px] shrink-0 min-h-0 flex flex-col">
                    <TranscriptFile tasks={tasks} onEnqueue={enqueue} />
                </div>
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                    <TranscriptTable tasks={tasks} onStart={start} onDelete={remove} />
                </div>
            </div>
        </div>
    );
};

export default TranscriptPage;
