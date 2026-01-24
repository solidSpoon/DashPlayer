import { cn } from '@/fronted/lib/utils';
import { getTtsUrl, playAudioUrl } from '@/common/utils/AudioPlayer';
import { useState } from 'react';
import { Loader, Volume2 } from 'lucide-react';
import { getRendererLogger } from '@/fronted/log/simple-logger';

export interface PlayableProps {
    className?: string;
    children?: string;
}

const Playable = ({ className, children }: PlayableProps) => {
    const logger = getRendererLogger('Playable');
    const [loading, setLoading] = useState(false);
    return (
        <span
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onMouseUp={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const selectedText = window.getSelection()?.toString() || '';
                if (selectedText.length > 0) {
                    return;
                }
                const str = children || '';
                if (!str.trim()) {
                    return;
                }
                setLoading(true);
                try {
                    logger.debug('Generating TTS for text', { text: str });
                    const ttsUrl = await getTtsUrl(str);
                    logger.debug('TTS URL generated', { ttsUrl });
                    await playAudioUrl(ttsUrl);
                } catch (error) {
                    logger.error('TTS playback failed', { error });
                } finally {
                    setLoading(false);
                }
            }}
            className={cn(' cursor-pointer hover:underline', className)}>
            {children}

            {loading ? <Loader className={'inline-block ml-1 w-4 h-4'} /> :
                <Volume2 className={'inline-block ml-1 w-4 h-4'} />}
        </span>
    );
};

Playable.defaultProps = {
    className: '',
    children: ''
};

export default Playable;
