import useSWR from 'swr';
import { cn } from '@/fronted/lib/utils';
import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { Film } from 'lucide-react';
import TimeUtil from '@/common/utils/TimeUtil';
import { Progress } from '@/fronted/components/ui/progress';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import { Button } from '@/fronted/components/ui/button';
import useConvert from '../convertStore';
import { useShallow } from 'zustand/react/shallow';
import { emptyFunc } from '@/common/utils/Util';
import { ConvertResult } from '@/common/contracts/convert';
import { DpTaskState } from '@/common/contracts/dp-task';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from '@/common/utils/UrlUtil';
import { convertApi } from '../convertApi';
import i18n from '@/fronted/i18n';

const ConvertItem = ({ file, onSelected, className, buttonVariant, onDeleted }: {
    file: string,
    className?: string,
    onSelected: () => void;
    buttonVariant?: 'default' | 'small';
    onDeleted?: () => void;
}) => {
    const { t } = useI18nTranslation('pages');
    const { data: url } = useSWR(file ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, file, 5] : null,
        async ([, path, time]) => {
            return await convertApi.getThumbnail(path, time);
        }
    );
    const { data: videoLength } = useSWR(file ? ['duration', file] : null, async ([, f]) => {
        return await convertApi.getDuration(f);
    }, { revalidateOnFocus: false });
    const {
        taskId,
        convert
    } = useConvert(useShallow(s => ({
        taskId: s.tasks.get(file),
        convert: s.convert
    })));
    const { task: dpTask } = useDpTaskViewer(taskId);
    const resultJson = dpTask?.result;
    const progress = StrUtil.isNotBlank(resultJson) ? JSON.parse(resultJson) : {
        progress: 0,
        path: file
    } as ConvertResult;


    const isRunning = dpTask?.status === DpTaskState.IN_PROGRESS;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    onClick={onSelected}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelected();
                        }
                    }}
                    className={cn(
                        'group flex gap-4 p-3.5 relative rounded-xl overflow-hidden transition-all text-foreground select-none',
                        className
                    )}
                >
                    {/* 视频缩略图 */}
                    <div className="relative w-36 sm:w-40 shrink-0 rounded-lg overflow-hidden bg-muted/60 border border-border/40 aspect-video flex items-center justify-center">
                        {url ? (
                            <img
                                src={UrlUtil.toUrl(url)}
                                className="w-full h-full object-cover"
                                alt={file}
                            />
                        ) : (
                            <Film className="w-6 h-6 text-muted-foreground/60" />
                        )}
                        {videoLength !== undefined && (
                            <div className="absolute bottom-1.5 right-1.5 text-white bg-black/75 backdrop-blur-xs rounded px-1.5 py-0.5 text-[11px] font-mono leading-none">
                                {TimeUtil.secondToTimeStrCompact(videoLength)}
                            </div>
                        )}
                    </div>

                    {/* 文件名及操作区 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-foreground line-clamp-2 break-all leading-snug" title={file}>
                                {file.split(/[/\\]/).pop() || file}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate" title={file}>
                                {file}
                            </span>
                        </div>

                        <div className="w-full flex items-center justify-between mt-2 pt-1">
                            {/* 进度/状态简述 */}
                            <div className="text-[11px] font-mono text-muted-foreground">
                                {isRunning && progress.progress !== undefined ? `${Math.round(progress.progress)}%` : ''}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <Button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (isRunning) {
                                            if (taskId === undefined) {
                                                throw new Error(`转换任务缺少任务编号：${file}`);
                                            }
                                            await convertApi.cancelTask(taskId);
                                        } else {
                                            onDeleted?.();
                                        }
                                    }}
                                    className={cn(
                                        buttonVariant === 'small' ? 'px-2 py-0 text-xs h-6.5' : 'h-7 px-2.5 text-xs'
                                    )}
                                    size="sm"
                                    variant="ghost"
                                >
                                    {isRunning ? t('formatConverter.cancel') : t('formatConverter.delete')}
                                </Button>
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        convert(file);
                                    }}
                                    disabled={isRunning}
                                    className={cn(
                                        buttonVariant === 'small' ? 'px-2.5 py-0 text-xs h-6.5 font-medium' : 'h-7 px-3 text-xs font-medium'
                                    )}
                                    size="sm"
                                    variant={isRunning ? 'secondary' : 'default'}
                                >
                                    {t('formatConverter.fix')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 底部进度条 */}
                    {isRunning && (
                        <Progress
                            className="absolute bottom-0 left-0 w-full rounded-none h-1 bg-muted/40 [&>*]:transition-transform [&>*]:duration-500"
                            value={progress.progress}
                        />
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={async () => {
                        await convertApi.openFolder(file);
                    }}
                >
                    {i18n.t('common:showInExplorer')}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );


};
ConvertItem.defaultProps = {
    buttonVariant: 'default',
    className: '',
    onDeleted: emptyFunc
};

export default ConvertItem;
