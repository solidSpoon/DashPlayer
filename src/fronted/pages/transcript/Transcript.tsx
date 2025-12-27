import React from 'react';
import {cn} from "@/fronted/lib/utils";
import Separator from '@/fronted/components/shared/common/Separator';
import TranscriptFile from './TranscriptFile';
import TranscriptTable from '@/fronted/pages/transcript/TranscriptTable';

const Transcript = () => {
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
                    Add subtitles to your videos using AI-powered speech recognition
                </h2>
                <Separator orientation="horizontal" className="px-0"/>
            </div>

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
