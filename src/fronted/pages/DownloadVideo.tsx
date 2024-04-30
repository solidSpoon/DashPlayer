import {cn} from "@/fronted/lib/utils";
import Separator from "@/fronted/components/Separtor";
import React from "react";
import {Input} from "@/fronted/components/ui/input";
import {Button} from "@/fronted/components/ui/button";
import {strNotBlank} from "@/common/utils/Util";
import Md from "@/fronted/components/chat/markdown";
import {codeBlock} from "common-tags";
import toast from 'react-hot-toast';

const api = window.electron;
const DownloadVideo = () => {

    const [url, setUrl] = React.useState<string>('');
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
                           value={url} onChange={e => setUrl(e.target.value)}
                    />
                    <Button
                        onClick={async () => {
                            if (strNotBlank(url)) {
                                await api.call('download-video/url', {url})
                                toast('Check your Terminal')
                            }
                        }}
                        type="submit">Download</Button>
                </div>
                <div className={'w-full max-w-3xl mt-10'}>
                    <Md>
                        {codeBlock`
                        ## 使用说明

                        - 在上方输入框中粘贴视频链接，然后点击下载按钮即可下载视频。
                        - 下载时会弹出命令行窗口，便于您查看进度，下载完成后您可以关闭。
                        - 这个命令行内预置了 \`ffmpeg\`、\`ffprobe\`、\`yt-dlp\` 等命令，您可以在这个窗口内使用这些命令进一步处理视频。
                        - 下载的视频会保存在您的下载文件夹中。
                        `}
                    </Md>
                </div>
            </div>
        </div>
    )
}

export default DownloadVideo;
