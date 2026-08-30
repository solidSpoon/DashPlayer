import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import { useTranslation } from 'react-i18next';

interface PlaybackIssueToastProps {
    onConvert: () => void;
    onIgnore: () => void;
}

export function PlaybackIssueToast({ onConvert, onIgnore }: PlaybackIssueToastProps) {
    const { t } = useTranslation('player');

    return (
        <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
                <div className="font-semibold text-sm leading-snug">
                    {t('compatToastIssueTitle')}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                    {t('compatToastIssueDescription')}
                </div>
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={onIgnore}
                >
                    {t('compatToastIgnore')}
                </Button>
                <Button
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={onConvert}
                >
                    {t('compatToastAction')}
                </Button>
            </div>
        </div>
    );
}
