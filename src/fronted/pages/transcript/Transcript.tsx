import React from 'react';
import {cn} from "@/fronted/lib/utils";
import TranscriptFile from './TranscriptFile';
import TranscriptTable from '@/fronted/pages/transcript/TranscriptTable';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const Transcript = () => {
    const { t } = useI18nTranslation('pages');
    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background px-6 py-4 gap-4 text-foreground'
            )}
        >
            <PageHeader
                title={t('subtitleWorkspace.title')}
                description={t('subtitleWorkspace.description')}
            />

            <div className="grid grid-cols-2 gap-10 flex-1 h-0 pl-10 pb-6 pr-16"
                 style={{
                     gridTemplateColumns: '40% 60%',
                     gridTemplateRows: '100%'
                 }}
            >
                <TranscriptFile />
                <TranscriptTable />
            </div>
        </div>
    );
};

export default Transcript;
