import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@/fronted/components/ui/table';
import { cn } from "@/fronted/lib/utils";
import TranscriptItem from './TranscriptItem';
import React from 'react';
import useTranscript from '../transcriptStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const TranscriptTable = () => {
    const { t } = useI18nTranslation('pages');
    const { files, onDelFromQueue, onTranscript } = useTranscript(useShallow(s => ({
        files: s.files,
        onDelFromQueue: s.onDelFromQueue,
        onTranscript: s.onTranscript
    })));

    if (files.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground rounded-lg border bg-muted/20">
                {t('subtitleWorkspace.table.empty')}
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
