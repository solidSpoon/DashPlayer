import { cn } from '@/fronted/lib/utils';
import { getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import { useState } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { getRendererLogger } from '@/fronted/log/simple-logger';

export interface PlayableProps {
    className?: string;
    children?: string;
    showIcon?: boolean;
}

const Playable = ({ className, children, showIcon = true }: PlayableProps) => {
    const logger = getRendererLogger('Playable');
    const [loading, setLoading] = useState(false);

    const playSound = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const str = children || '';
        if (!str.trim() || loading) {
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
    };

    return (
        <span className={cn('inline items-baseline select-text group/playable', className)}>
            <span className="select-text">{children}</span>

            {showIcon && (
                <button
                    type="button"
                    onClick={playSound}
                    disabled={loading}
                    tabIndex={-1}
                    className="inline-flex items-center justify-center p-0.5 ml-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted/70 align-middle transition-colors cursor-pointer disabled:opacity-50 select-none"
                    title="朗读"
                >
                    {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                    )}
                </button>
            )}
        </span>
    );
};

export default Playable;
