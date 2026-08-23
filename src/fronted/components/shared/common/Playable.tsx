import { cn } from '@/fronted/lib/utils';
import { getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import React, { useRef, useState } from 'react';
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
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

    const playSound = async (str: string) => {
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

    const handleIconClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        await playSound(children || '');
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        mouseDownPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = async (e: React.MouseEvent<HTMLSpanElement>) => {
        const startPos = mouseDownPos.current;
        mouseDownPos.current = null;

        // 如果鼠标发生了明显拖拽位移（> 4px），认为是划选操作，不触发点击发音
        if (startPos) {
            const dx = Math.abs(e.clientX - startPos.x);
            const dy = Math.abs(e.clientY - startPos.y);
            if (dx > 4 || dy > 4) {
                return;
            }
        }

        // 检查当前是否有非折叠选区（例如用户双击或拖拽选中了文字）
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
            if (selection.containsNode(e.currentTarget, true)) {
                return;
            }
        }

        await playSound(children || '');
    };

    return (
        <span
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            className={cn(
                'inline items-baseline select-text cursor-pointer hover:underline group/playable',
                className
            )}
        >
            <span className="select-text">{children}</span>

            {showIcon && (
                <button
                    type="button"
                    onClick={handleIconClick}
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

