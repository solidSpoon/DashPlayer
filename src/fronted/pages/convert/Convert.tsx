import {cn} from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import React from 'react';
import ConvertFileSelector from "@/fronted/pages/convert/ConvertFileSelector";
import ConvertFolderSelector from "@/fronted/pages/convert/FolderSelector";
import ConvertItem from "@/fronted/pages/convert/convert-item";

interface FolderVideos {
    folder: string;
    videos: string[];
}

const api = window.electron;
const Convert = () => {
    const [files, setFiles] = React.useState<string[]>([]);
    const [folders, setFolders] = React.useState<FolderVideos[]>([]);
    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background p-6 pt-12 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Convert mkv to mp4
                </h1>
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Convert mkv to mp4 with subtitles
                </h2>
                <Separator orientation="horizontal" className="px-0"/>
            </div>
            <div className={cn('flex flex-col w-full h-0 flex-1 px-10 pr-16')}>
                <div
                    className={cn('justify-self-end flex mb-10 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                >
                    <ConvertFileSelector
                        onSelected={async (ps) => {
                            setFiles((prev) => [...prev, ...ps]);
                        }}
                    />
                    <ConvertFolderSelector
                        onSelected={async (fp) => {
                            const folderList = await api.call('convert/from-folder', fp);
                            setFolders((prev) => [...prev, ...folderList]);
                        }}
                    />
                </div>
                <div className={cn('flex flex-col gap-4 h-0 flex-1 overflow-y-auto scrollbar-none p-2')}>

                    {folders.map((folder) => {
                        return (
                            <div className={cn('flex flex-col gap-4 border p-4 rounded-lg bg-muted')}>
                                <h2 className={cn('text-xl font-semibold')}>
                                    {folder.folder}
                                </h2>
                                <div className={cn('grid grid-cols-2 gap-2')}>
                                    {folder.videos.map((file) => {
                                        return <ConvertItem buttonVariant={'small'} className={'bg-background drop-shadow'} file={file} onSelected={() => {
                                            console.log('selected', file);
                                        }}/>
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {files.map((file) => {
                        return <ConvertItem className={'border'} file={file} onSelected={() => {
                            console.log('selected', file);
                        }}/>
                    })}
                </div>
            </div>
        </div>
    );
};
export default Convert;
