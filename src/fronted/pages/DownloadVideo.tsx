import {cn} from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import React from 'react';
import {Input} from '@/fronted/components/ui/input';
import {Button} from '@/fronted/components/ui/button';
import Util, {strNotBlank} from '@/common/utils/Util';
import {useLocalStorage} from '@uidotdev/usehooks';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import toast from 'react-hot-toast';
import {DpTask, DpTaskState} from '@/backend/db/tables/dpTask';
import {DlProgress} from "@/common/types/dl-progress";
import {Progress} from "@/fronted/components/ui/progress";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import {Car} from "lucide-react";

const api = window.electron;

function extracted(dpTask: DpTask): DlProgress {
    try {
        return dpTask?.result ? JSON.parse(dpTask.result) : {name: '', progress: 0, stdOut: ''};
    } catch (e) {
        return {name: '', progress: 0, stdOut: ''};
    }
}

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
    const {name, progress, stdOut} = extracted(dpTask);
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
                <Separator orientation="horizontal" className="px-0"/>
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
                                const taskId = await useDpTaskCenter.getState().register(() => api.call('download-video/url', {url}), {
                                    onFinish: async (task) => {
                                        const {name} = extracted(task);
                                        toast.success(`Downloaded ${name}`);
                                        await api.call('watch-project/create/from-download', name);
                                    }
                                });
                                setTaskId(taskId);
                            }
                        }}
                        type="submit">Download</Button>
                </div>
                {taskId ? <>
                        <Card className={'w-full max-w-3xl mt-4'}>
                            <CardHeader>
                                <CardTitle>
                                    下载视频
                                </CardTitle>
                                <CardDescription>
                                    文件将保存在下载文件夹
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className={'text-sm'}
                                >{name}</div>
                                <Progress className={'h-1 mt-2'} value={progress} max={100}/>
                            </CardContent>

                        </Card>
                    </> :
                    <div className="mt-10 text-sm text-secondary-foreground">Paste a video URL and click download</div>}

                <pre
                    className={cn('rounded overflow-auto scrollbar-none w-full mt-auto h-80 p-4 text-sm font-mono select-text border')}
                    ref={consoleRef}
                >
                    {stdOut}
                </pre>
            </div>
        </div>
    );
};

export default DownloadVideo;
