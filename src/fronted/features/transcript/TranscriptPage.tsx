import React from 'react';
import TranscriptFile from './components/TranscriptFile';
import TranscriptTable from './components/TranscriptTable';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { transcriptApi } from './transcriptApi';

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

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <PageHeader
                    title={t('subtitleWorkspace.title')}
                    description={t('subtitleWorkspace.description')}
                />
            </div>

            <div className="flex-1 min-h-0 flex gap-6 px-6 py-5 overflow-hidden">
                <div className="w-[40%] shrink-0 min-h-0 flex flex-col">
                    <TranscriptFile tasks={tasks} onEnqueue={enqueue} />
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                    <TranscriptTable tasks={tasks} onStart={start} onDelete={remove} />
                </div>
            </div>
        </div>
    );
};

export default TranscriptPage;
