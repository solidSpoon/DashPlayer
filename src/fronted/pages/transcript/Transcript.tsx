import React from 'react';
import {cn} from "@/fronted/lib/utils";
import Separator from '@/fronted/components/Separtor';
import {useLocalStorage} from '@uidotdev/usehooks';
import TranscriptFile from './TranscriptFile';
import TranscriptTable, {TranscriptTask} from '@/fronted/pages/transcript/TranscriptTable';
import useDpTaskCenter from "@/fronted/hooks/useDpTaskCenter";
import {SWR_KEY, swrMutate} from "@/fronted/lib/swr-util";
import toast from 'react-hot-toast';

const api = window.electron;
const Transcript = () => {

    const [files, setFiles] = useLocalStorage<TranscriptTask[]>('transcriptFiles', []);

    const registerTask = useDpTaskCenter(s => s.register);
    const onAddToQueue = async (p: string) => {
        const video = {
            file: p,
            taskId: null
        } as TranscriptTask;
        // 按照 path 合并，注意保留 taskId
        const currentFiles = files.map((f) => f.file);
        if (!currentFiles.includes(video.file)) {
            setFiles([...files, video]);
        }
    };

    const onTranscript = async (file: TranscriptTask) => {
            const taskId = await registerTask(() => api.call('ai-func/transcript', {filePath: file.file}), {
                onFinish: async (task) => {
                    await api.call('watch-project/attach-srt', {
                        videoPath: file.file,
                        srtPath: 'same'
                    });
                    await swrMutate(SWR_KEY.PLAYER_P);
                    toast('Transcript done',{
                        icon: '🚀'
                    });
                }
            });
            const newFiles = files.map((f) => {
                if (f.file === file.file) {
                    return {...f, taskId};
                }
                return f;
            });
            setFiles(newFiles);
        }
    ;

    const onDelete = async (file: TranscriptTask) => {
        const newFiles = files.filter((f) => f.file !== file.file);
        setFiles(newFiles);
    };
    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background p-6 pt-12 gap-4 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Transcript
                </h1>
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Add subtitles to your videos using OpenAI's Whisper Large model
                </h2>
                <Separator orientation="horizontal" className="px-0"/>
            </div>

            <div className="grid grid-cols-2 gap-10 flex-1 h-0 pl-10 pb-6 pr-16"
                 style={{
                     gridTemplateColumns: '40% 60%',
                     gridTemplateRows: '100%'
                 }}
            >
                <TranscriptFile onAddToQueue={onAddToQueue} queue={files.map(f => f.file)}/>
                <TranscriptTable onTranscript={onTranscript} files={files} onDelete={onDelete}/>
            </div>
        </div>
    );
};

export default Transcript;
