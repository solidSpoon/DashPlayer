import { useTranslation } from 'react-i18next';
import { Mic } from 'lucide-react';

import { cn } from '@/fronted/lib/utils';
import { useDubbing } from '../dubbingStore';

interface DubbingMarkProps {
    /** 字幕句序号。 */
    sentenceIndex: number;
}

/**
 * 侧边字幕栏的“已配音”标记：只展示话筒图标，不承载交互；
 * 由 SideSentence 放在左侧状态图标列（播放/暂停指示器）下方，
 * 未配音时透明占位，保证文字排版不跳变。
 */
export default function DubbingMark({ sentenceIndex }: DubbingMarkProps) {
    const { t } = useTranslation('player');
    const hasTakes = useDubbing((s) => {
        const record = s.manifest?.sentences[String(sentenceIndex)];
        return !!record && record.takes.length > 0;
    });

    return (
        <div
            aria-label={t('dubbing.micLabel')}
            title={hasTakes ? t('dubbing.micLabel') : undefined}
            className={cn(
                'flex items-center justify-center w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400 transition-opacity duration-200 pointer-events-none',
                hasTakes ? 'opacity-100' : 'opacity-0'
            )}
        >
            <Mic className="w-3 h-3" />
        </div>
    );
}
