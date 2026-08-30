import { Button } from '@/fronted/components/ui/button';
import React from 'react';

interface ModeSwitchToastProps {
    mode: 'podcast' | 'video';
    onCancel: () => void;
}

const icons = {
    podcast: '🎙️',
    video: '📺'
} as const;

export function ModeSwitchToast({ mode, onCancel }: ModeSwitchToastProps) {
    return (
        <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-foreground">
                <span>{icons[mode]}</span>
                <span>{mode === 'podcast' ? '已自动切换至播客模式' : '已自动切换至视频模式'}</span>
            </span>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={onCancel}
            >
                恢复
            </Button>
        </div>
    );
}
