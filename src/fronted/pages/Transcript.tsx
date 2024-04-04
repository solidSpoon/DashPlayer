import React from 'react';
import { cn } from '@/common/utils/Util';
import Separator from '@/fronted/components/Separtor';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import { Button } from '@/fronted/components/ui/button';
import FileT, { FileType } from '@/common/types/FileT';
import { WatchProjectVO } from '@/backend/services/WatchProjectService';

const api = window.electron;
const Transcript = () => {

    const [files, setFiles] = React.useState<FileT[]>([]);
    const onSelectedFile = async () => {
        const res = await api.selectFile(false);
        console.log('file', res);
        // 判断是否为 string
        if (typeof res === 'string') {
            return;
        }
        const f = res as WatchProjectVO;
        const videos = f.videos.map((v) => ({
            fileName: v.video_name,
            objectUrl: '',
            fileType: FileType.VIDEO,
            path: v.video_path
        } as FileT));
        const fileTS = [...files, ...videos].filter((f, index, self) => {
            return index === self.findIndex((t) => (
                t.path === f.path
            ));
        });
        setFiles(fileTS);
    };

    const onTranscript = async () => {
        const filePaths = files.map((f) => f.path);
        console.log('filePaths', filePaths);
        await api.transcript(filePaths);
    }
    return (
        <div
            className={cn(
                'w-full h-screen flex flex-col overflow-hidden select-none bg-background p-6 pt-12 gap-4 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Transcript
                </h1>
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Dash Player
                </h2>
                <Separator orientation="horizontal" className="px-0" />
            </div>

            <div className="flex flex-col flex-1 h-0 items-center px-11 pb-6">
                <div className="flex flex-col flex-1 h-0 w-full max-w-[800px]">
                    <Table className={cn('h-0 w-full flex-1')}>
                        <TableCaption>A list of your recent invoices.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="">视频</TableHead>
                                <TableHead className={'w-20 text-center'}>状态</TableHead>
                                <TableHead className={'w-32 text-center'}>操作</TableHead>
                                {/* <TableHead className="text-right">Amount</TableHead> */}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {files.map((f) => (
                                <TableRow>
                                    <TableCell className="font-medium">{f.fileName}</TableCell>
                                    <TableCell className={cn('text-center')}>Paid</TableCell>
                                    <TableCell className={cn('text-center')}>
                                        <Button size={'sm'} className={'mx-auto'}>删除</Button>
                                    </TableCell>
                                </TableRow>
                            ))}

                            <TableRow>
                                <TableCell className="font-medium"></TableCell>
                                <TableCell className={cn('text-center')}></TableCell>
                                <TableCell className={cn('text-center')}><Button size={'sm'} variant={'secondary'}
                                                                                 className={'mx-auto'}>添加</Button></TableCell>
                                {/* <TableCell className="text-right">$250.00</TableCell> */}
                            </TableRow>
                        </TableBody>
                    </Table>
                    {/* <Separator orientation="horizontal" className="mt-auto" /> */}
                    <div className="mt-auto w-full flex justify-end gap-2">
                        <Button
                            onClick={onSelectedFile}
                            variant={'secondary'} className={cn('')}>添加视频</Button>
                        <Button
                            onClick={onTranscript}
                            className={cn('')}>开始转录</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Transcript;
