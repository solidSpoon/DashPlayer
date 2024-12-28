import { Button } from '@/fronted/components/ui/button';
import React from 'react';

interface ModeSwitchToastProps {
    mode: 'podcast' | 'video'
    onCancel: () => void
}

const icons = {
    podcast: '🎙️',
    video: '📺'
} as const

export function ModeSwitchToast({ mode, onCancel }: ModeSwitchToastProps) {
    return (
        <div className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        <span>{icons[mode]}</span>
        <span>{mode === 'podcast' ? 'Podcast Mode' : 'Video Mode'} Enabled</span>
      </span>
            <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
            >
                Cancel
            </Button>
        </div>
    )
}
