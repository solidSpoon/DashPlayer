import React from 'react';
import TranscriptFile from './TranscriptFile';
import TranscriptTable from '@/fronted/pages/transcript/TranscriptTable';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const Transcript = () => {
    const { t } = useI18nTranslation('pages');
    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <PageHeader
                    title={t('subtitleWorkspace.title')}
                    description={t('subtitleWorkspace.description')}
                />
            </div>

            <div className="flex-1 min-h-0 flex gap-6 px-6 py-5 overflow-hidden">
                <div className="w-[40%] shrink-0 min-h-0 flex flex-col">
                    <TranscriptFile />
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                    <TranscriptTable />
                </div>
            </div>
        </div>
    );
};

export default Transcript;
