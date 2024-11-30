import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import React from 'react';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import { useLocalStorage } from '@uidotdev/usehooks';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import toast from 'react-hot-toast';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import { DlProgress } from '@/common/types/dl-progress';
import { Progress } from '@/fronted/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { CircleX, CloudDownload, EllipsisVertical } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/fronted/components/ui/dropdown-menu';
import useTranscript from '@/fronted/hooks/useTranscript';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import StrUtil from '@/common/utils/str-util';
import { Nullable } from '@/common/types/Types';
import PathUtil from '@/common/utils/PathUtil';
import { BsBrowserChrome, BsBrowserEdge, BsBrowserFirefox, BsBrowserSafari, BsIncognito } from 'react-icons/bs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { COOKIE, cookieType } from '@/common/types/DlVideoType';

const api = window.electron;

function extracted(dpTask: Nullable<DpTask>): DlProgress {
    try {
        return dpTask?.result ? JSON.parse(dpTask.result) : { name: '', progress: 0, stdOut: '' };
    } catch (e) {
        return { name: '', progress: 0, stdOut: '' };
    }
}

const DownloadVideo = () => {

    const [taskId, setTaskId] = useLocalStorage<number | null>('download-video-task-id');
    const { task: dpTask } = useDpTaskViewer(taskId);
    console.log('task', dpTask);
    const [url, setUrl] = useLocalStorage('download-video-url', '');
    const [cookies, setCookies] = useLocalStorage<COOKIE>('download-video-cookies', 'no-cookie');
    const consoleRef = React.useRef<HTMLPreElement>(null);
    React.useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [dpTask?.result]);
    const inProgress = dpTask?.status === DpTaskState.IN_PROGRESS
        || dpTask?.status === DpTaskState.INIT;
    const { name, progress, stdOut } = extracted(dpTask);
    const successMsg = 'Downloaded successfully, check the download folder\n'
        + 'If there is a transcription task, please check it on the transcript page';
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
            <div className={cn('h-0 flex-1 flex flex-col items-center gap-2')}>
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
                            if (StrUtil.isNotBlank(url)) {
                                const taskId = await useDpTaskCenter.getState().register(() => api.call('download-video/url', {
                                    url,
                                    cookies
                                }), {
                                    onFinish: async (task) => {
                                        if (task.status !== DpTaskState.DONE) return;
                                        const { name } = extracted(task);
                                        toast.success(`Downloaded ${name}, Start transcription`);
                                        // todo
                                        const [pId] = await api.call('watch-history/create/from-library', [name]);
                                        const watchProjectVideo = await api.call('watch-history/detail', pId);
                                        await useTranscript.getState().onTranscript(PathUtil.join(watchProjectVideo?.basePath, watchProjectVideo?.fileName));
                                    }
                                });
                                setTaskId(taskId);
                            }
                        }}
                        type="submit">DL & Transcript</Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <Button variant={'outline'} size={'icon'}>
                                <EllipsisVertical />
                            </Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem
                                onClick={async () => {
                                    if (StrUtil.isNotBlank(url)) {
                                        const taskId = await useDpTaskCenter.getState().register(() => api.call('download-video/url', {
                                            url,
                                            cookies
                                        }), {
                                            onFinish: async (task) => {
                                                if (task.status !== DpTaskState.DONE) return;
                                                const { name } = extracted(task);
                                                toast.success(`Downloaded ${name}, Check the download folder`);
                                            }
                                        });
                                        setTaskId(taskId);
                                    }
                                }}
                            ><CloudDownload className={'h-4 w-4 mr-2'} />Download Only</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex w-full max-w-3xl items-center space-x-2">
                    <Select value={cookies} onValueChange={s => setCookies(s as COOKIE)}>
                        <SelectTrigger>
                            <SelectValue placeholder={<BsBrowserChrome />} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={cookieType('chrome')}>
                                <div className="flex items-center">
                                    <BsBrowserChrome className="h-4 w-4 mr-2" />
                                    Cookies from Chrome
                                </div>
                            </SelectItem>
                            <SelectItem value={cookieType('edge')}>
                                <div className="flex items-center">
                                    <BsBrowserEdge className="h-4 w-4 mr-2" />
                                    Cookies from Edge
                                </div>
                            </SelectItem>
                            <SelectItem value={cookieType('firefox')}>
                                <div className="flex items-center">
                                    <BsBrowserFirefox className="h-4 w-4 mr-2" />
                                    Cookies from Firefox
                                </div>
                            </SelectItem>
                            <SelectItem value={cookieType('safari')}>
                                <div className="flex items-center">
                                    <BsBrowserSafari className="h-4 w-4 mr-2" />
                                    Cookies from Safari
                                </div>
                            </SelectItem>
                            <SelectItem value={cookieType('no-cookie')}>
                                <div className="flex items-center">
                                    <BsIncognito className="h-4 w-4 mr-2" />
                                    No Cookies
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {taskId ? <>
                        <Card className={'w-full relative max-w-3xl mt-4'}>
                            <CardHeader>
                                <CardTitle>
                                    下载视频
                                </CardTitle>
                                <CardDescription>
                                    文件将保存在 Library 的 videos 文件夹中
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className={'text-sm'}
                                >{name}</div>
                                <Progress className={'h-1 mt-2'} value={progress} max={100} />
                            </CardContent>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            disabled={dpTask?.status === DpTaskState.DONE || dpTask?.status === DpTaskState.CANCELLED}
                                            variant={'ghost'}
                                            size={'icon'}
                                            className={cn('absolute top-2 right-2 h-8 w-8')} onClick={() => {
                                            api.call('dp-task/cancel', taskId);
                                        }}><CircleX className={'h-4 w-4'} /></Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Cancel Task</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Card>
                    </> :
                    <div className="mt-10 text-sm text-secondary-foreground">Paste a video URL and click download</div>}

                <pre
                    className={cn('rounded overflow-auto scrollbar-none w-full mt-auto h-80 p-4 text-sm font-mono select-text border')}
                    ref={consoleRef}
                >
                    {stdOut}
                    {dpTask?.status === DpTaskState.DONE && `\n\n${successMsg}`}
                    {dpTask?.status === DpTaskState.CANCELLED && `\n\nDownload cancelled`}
                </pre>
            </div>
        </div>
    )
        ;
};

export default DownloadVideo;
