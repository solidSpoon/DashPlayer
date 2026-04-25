import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import { cn } from "@/fronted/lib/utils";
import TranscriptItem from '@/fronted/pages/transcript/TranscriptItem';
import React from 'react';
import useTranscript from '@/fronted/hooks/useTranscript';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Captions } from 'lucide-react';

const TranscriptTable = () => {
    const { t } = useI18nTranslation('pages');
    const { files, onDelFromQueue, onTranscript } = useTranscript(useShallow(s => ({
        files: s.files,
        onDelFromQueue: s.onDelFromQueue,
        onTranscript: s.onTranscript
    })));

    if (files.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground rounded-lg border bg-muted/20 gap-3 p-8">
                <div className="p-4 rounded-full bg-muted/30">
                    <Captions className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium">{t('subtitleWorkspace.table.empty')}</p>
                    <p className="text-xs opacity-70 mt-1">从左侧选择一个视频或将其拖入此处开始生成</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex-1 overflow-auto scrollbar-thin rounded-lg border bg-muted/20')}>
            <Table className="w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('subtitleWorkspace.table.videoColumn')}</TableHead>
                        <TableHead className="w-40">{t('subtitleWorkspace.table.statusColumn')}</TableHead>
                        <TableHead className="w-36">{t('subtitleWorkspace.table.actionColumn')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {files.map((f) => (
                        <TranscriptItem
                            key={f.file}
                            file={f.file}
                            onStart={() => onTranscript(f.file)}
                            onDelete={() => onDelFromQueue(f.file)}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
export default TranscriptTable;
