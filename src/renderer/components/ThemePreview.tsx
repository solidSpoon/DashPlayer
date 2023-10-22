import React from 'react';
import { twJoin } from 'tailwind-merge';
import {
    colorfulProp,
    isColorfulTheme,
    usingThemeName,
} from '../hooks/useSetting';

export interface ThemePreviewParam {
    theme: string;
    className: string;
}
const themePreview = ({ className, theme }: ThemePreviewParam) => {
    const isColorful = isColorfulTheme(usingThemeName(theme));
    return (
        <div
            className={twJoin(
                `${className} bg-background relative top-0 left-0`
            )}
        >
            {isColorful && (
                <div
                    className={twJoin(
                        'absolute top-0 left-0 h-full w-full',
                        colorfulProp(theme)
                    )}
                />
            )}
            <div
                className={twJoin(
                    `absolute w-full h-full  flex`,
                    isColorful ? 'bg-white/80 backdrop-blur' : 'bg-background'
                )}
            >
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 bg-gradient-to-br from-indigo-500/50 via-purple-500/50 to-pink-500/50" />
                    <div className="h-1 bg-gutterBackground" />
                    <div className="h-1/3 pt-1 px-2">
                        <div className="w-full h-4 rounded bg-sentenceBackground" />
                    </div>
                </div>
                <div className="w-1 bg-gutterBackground" />
                <div className="w-1/3 flex flex-col gap-1 overflow-y-hidden px-1">
                    {[...Array(10)].map((_, i) => (
                        <div
                            className={twJoin(
                                'flex-shrink-0 rounded h-4',
                                isColorful
                                    ? 'bg-sentenceBackground/80'
                                    : 'bg-sentenceBackground'
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default themePreview;
