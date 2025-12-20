import useSWR from 'swr';
import { cn } from '@/fronted/lib/utils';
import React from 'react';
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
import useConvert from '@/fronted/hooks/useConvert';
import { useShallow } from 'zustand/react/shallow';
import { emptyFunc } from '@/common/utils/Util';
import { ConvertResult } from '@/common/types/tonvert-type';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import StrUtil from '@/common/utils/str-util';
import UrlUtil from "@/common/utils/UrlUtil";

const api = window.electron;

const ConvertItem = ({ file, onSelected, className, buttonVariant, onDeleted }: {
    file: string,
    className?: string,
    onSelected: () => void;
    buttonVariant?: 'default' | 'small';
    onDeleted?: () => void;
}) => {
    const { data: url } = useSWR(file ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, file, 5] : null,
        async ([key, path, time]) => {
            return await api.call('split-video/thumbnail', { filePath: path, time });
        }
    );
    const { data: videoLength } = useSWR(file ? ['duration', file] : null, async ([key, f]) => {
        return await api.call('convert/video-length', f);
    }, {
        revalidateOnFocus: false,
        fallbackData: 0
    });
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


    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    onClick={onSelected}
                    className={cn('flex gap-6  p-4 relative rounded-xl overflow-hidden', className)}>
                    <div className={cn('relative w-40 rounded-lg overflow-hidden')}>
                        {url ? <img
                            src={UrlUtil.file(url)}
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className="w-full object-cover"
                            alt={file}
                        /> : <div
                            style={{
                                aspectRatio: '16/9'
                            }}
                            className={'w-full bg-gray-500 flex items-center justify-center'}>
                            <Film />
                        </div>}
                        <div
                            className={cn('absolute bottom-2 right-2 text-white bg-black bg-opacity-80 rounded-md p-1 py-0.5 text-xs flex')}>
                            {TimeUtil.secondToTimeStrCompact(videoLength)}
                        </div>
                    </div>

                    <div className={'flex-1 w-0 flex flex-col'}>
                        <div
                            className={' w-full line-clamp-2 break-words h-fit'}
                        >{file}</div>
                        <div className={'w-full mt-auto flex gap-2 justify-end'}>

                            <Button
                                onClick={async () => {
                                    if (dpTask?.status === DpTaskState.IN_PROGRESS) {
                                        await api.call('dp-task/cancel', taskId);
                                    } else {
                                        onDeleted?.();
                                    }
                                }}
                                className={cn(buttonVariant === 'small' && 'px-2.5 py-0.5 text-xs h-6')}
                                size={'sm'}
                                variant={'secondary'}>
                                {dpTask?.status === DpTaskState.IN_PROGRESS ? 'Cancel' : 'Delete'}
                            </Button>
                            <Button
                                onClick={() => {
                                    convert(file);
                                }}
                                disabled={dpTask?.status === DpTaskState.IN_PROGRESS}
                                className={cn(buttonVariant === 'small' && 'px-2.5 py-0.5 text-xs h-6')}
                                size={'sm'} variant={'default'}>
                                生成
                            </Button>
                        </div>
                    </div>

                    <Progress
                        className={cn(
                            'absolute bottom-0 left-0 w-full rounded-none h-1 bg-gray-500',
                            '[&>*]:transition-transform [&>*]:duration-700 [&>*]:ease-out'
                        )}
                        value={progress.progress}
                    />
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={async () => {
                        await api.call('system/open-folder', file);
                    }}
                >Show In Explorer</ContextMenuItem>
                {/*<ContextMenuItem*/}
                {/*    onClick={async () => {*/}
                {/*        await api.call('watch-project/delete', proj.id);*/}
                {/*        await swrApiMutate('watch-history/list');*/}
                {/*    }}*/}
                {/*>Delete</ContextMenuItem>*/}
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
