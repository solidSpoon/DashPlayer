import React from 'react';
import { p } from '@/common/utils/Util';
import { FONT_SIZE } from '@/fronted/styles/style';
import { cn } from '@/fronted/lib/utils';
import { Sentence } from '@/common/types/SentenceC';
import TranslatableLineWrapper from './TranslatableLineWrapper';
import useSetting from '@/fronted/features/settings/settingsStore';

interface PlayerTranslatableSubtitleLineParam {
    sentence: Sentence;
    adjusted: boolean;
    clearAdjust: () => void;
}

const FullscreenTranslatableLine = ({
    sentence,
    adjusted,
    clearAdjust,
}: PlayerTranslatableSubtitleLineParam) => {
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const text = sentence.text;

    if (!p(text)) {
        return <div />;
    }

    return (
        <div
            className={cn(
                'flex justify-center items-center pointer-events-auto',
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large']
            )}
        >
            <TranslatableLineWrapper
                sentence={sentence}
                adjusted={adjusted}
                clearAdjust={clearAdjust}
                variant="plain"
                className="my-0 mx-10 py-1.5 px-4 bg-black/60 backdrop-blur-xs text-white rounded-lg shadow-lg"
                coreClassName="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
        </div>
    );
};

export default FullscreenTranslatableLine;

