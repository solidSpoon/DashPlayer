import React from 'react';
import { twJoin } from 'tailwind-merge';
import { cn } from '../../common/utils/Util';
import { themeProvider } from '../styles/style';

export interface ThemePreviewParam {
    theme: string;
    className: string;
}
const themePreview = ({ className, theme }: ThemePreviewParam) => {
    const dark = theme === 'dark';
    const t = themeProvider(theme);
    return (
        <div
            className={cn(
                'relative top-0 left-0',
                t('bg-background'),
                className
            )}
        >
            <div className={twJoin('absolute w-full h-full flex')}>
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 bg-gradient-to-br from-indigo-500/50 via-purple-500/50 to-pink-500/50" />
                    <div
                        className={cn('h-1 bg-zinc-200', dark && 'bg-zinc-700')}
                    />
                    <div className="h-1/3 pt-1 px-2">
                        <div
                            className={cn(
                                'w-full h-4 rounded',
                                t('bg-sentenceBackground'),
                            )}
                        />
                    </div>
                </div>
                <div className={cn('w-1 bg-zinc-200', dark && 'bg-zinc-700')} />
                <div className="w-1/3 flex flex-col gap-1 overflow-y-hidden px-1">
                    {[...Array(10)].map((_, i) => (
                        <div
                            className={cn(
                                'flex-shrink-0 rounded h-4',
                                t('bg-sentenceBackground'),
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default themePreview;
