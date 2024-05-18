import useSWR from 'swr';
import {cn} from "@/fronted/lib/utils";
import React from 'react';
import {SWR_KEY} from '@/fronted/lib/swr-util';
import {Film} from 'lucide-react';
import TimeUtil from "@/common/utils/TimeUtil";
import {Progress} from "@/fronted/components/ui/progress";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/fronted/components/ui/context-menu";
import {Badge} from "@/fronted/components/ui/badge";
import {Button} from '@/fronted/components/ui/button';

const api = window.electron;

const ConvertItem = ({file, onSelected, className, buttonVariant}: {
    file: string,
    className?: string,
    onSelected: () => void;
    buttonVariant?: 'default' | 'small';
}) => {
    const {data: url} = useSWR(file ?
            [SWR_KEY.SPLIT_VIDEO_THUMBNAIL, file, 5] : null,
        async ([key, path, time]) => {
            return await api.call('split-video/thumbnail', {filePath: path, time});
        }
    );
    const {data: videoLength} = useSWR(file ? ['duration', file] : null, async ([key, f]) => {
        return await api.call('convert/video-length', f);
    }, {
        revalidateOnFocus: false,
        fallbackData: 0
    });
    const [hover, setHover] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState(false);
    return (
        <ContextMenu
            onOpenChange={(open) => {
                setContextMenu(open);
            }}
        >
            <ContextMenuTrigger>
                <div
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    onClick={onSelected}
                    className={cn('flex gap-6  p-4 relative rounded-xl overflow-hidden', className)}>
                    <div className={cn('relative w-40 rounded-lg overflow-hidden')}>
                        {url ? <img
                            src={url}
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
                            <Film/>
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
                            {buttonVariant === 'default' ? <>
                                <Button size={'sm'} variant={'secondary'}>
                                    Delete
                                </Button>
                                <Button size={'sm'} variant={'default'}>
                                    Convert
                                </Button>
                            </> : <>
                                <Badge className={'rounded'} variant={'secondary'}>
                                    Delete
                                </Badge>
                                <Badge className={'rounded'} variant={'default'}>
                                    Convert
                                </Badge>
                            </>}

                        </div>
                    </div>

                    <Progress
                        className={cn('absolute bottom-0 left-0 w-full rounded-none h-1 bg-gray-500')}
                        value={75}
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
                {/*        await swrMutate(SWR_KEY.WATCH_PROJECT_LIST);*/}
                {/*    }}*/}
                {/*>Delete</ContextMenuItem>*/}
            </ContextMenuContent>
        </ContextMenu>

    );


};
ConvertItem.defaultProps = {
    buttonVariant: 'default',
    className: ''
}

export default ConvertItem;
