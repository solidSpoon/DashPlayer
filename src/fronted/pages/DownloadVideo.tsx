import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import React from 'react';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import { strNotBlank } from '@/common/utils/Util';
import { useLocalStorage } from '@uidotdev/usehooks';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import toast from 'react-hot-toast';
import { DpTaskState } from '@/backend/db/tables/dpTask';

const api = window.electron;
const DownloadVideo = () => {

    const [taskId, setTaskId] = useLocalStorage<number>('download-video-task-id', null);
    const dpTask = useDpTaskViewer(taskId);
    console.log('task', dpTask);
    const [url, setUrl] = useLocalStorage('download-video-url', '');
    const consoleRef = React.useRef<HTMLPreElement>(null);
    React.useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [dpTask?.result]);
    const inProgress = dpTask?.status === DpTaskState.IN_PROGRESS
        || dpTask?.status === DpTaskState.INIT;
    const successMsg = `文件保存在下载文件夹`;
    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background p-6 pt-12 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Download Video (Beta)
                </h1>
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Download videos from the internet
                </h2>
                <Separator orientation="horizontal" className="px-0" />
            </div>
            <div className={cn('h-0 flex-1 flex flex-col items-center')}>
                <div className="flex w-full max-w-3xl items-center space-x-2">
                    <Input type="url" placeholder="Paste video URL here"
                           value={url} onChange={e => {
                               setUrl(e.target.value);
                               setTaskId(null);
                           }}
                    />
                    <Button
                        disabled={inProgress}
                        onClick={async () => {
                            if (strNotBlank(url)) {
                                const taskId = await useDpTaskCenter.getState().register(() => api.call('download-video/url', { url }), {
                                    onFinish: (task) => {
                                        toast('done');
                                    }
                                });
                                setTaskId(taskId);
                            }
                        }}
                        type="submit">Download</Button>
                </div>
                {taskId ? <pre
                        className={'overflow-auto scrollbar-none w-full mt-10 p-4 bg-secondary-foreground text-background text-sm font-mono select-text'}
                        ref={consoleRef}
                    >
                    {dpTask?.result}
                        {dpTask?.status === DpTaskState.DONE && `\n\n${successMsg}   `}
                </pre> :
                    <div className="mt-10 text-sm text-secondary-foreground">Paste a video URL and click download</div>}
            </div>
        </div>
    );
};

export default DownloadVideo;
