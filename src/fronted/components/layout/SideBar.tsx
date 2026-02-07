import { useLocation, useNavigate } from 'react-router-dom';
import React, { cloneElement, ReactElement } from 'react';
import { cn } from '@/fronted/lib/utils';
import logoLight from '../../../../assets/logo-light.png';
import logoDark from '../../../../assets/logo-dark.png';
import useFile from '@/fronted/hooks/useFile';
import useSetting from '@/fronted/hooks/useSetting';
import { BookOpen, Captions, Rotate3D, Settings, SquareSplitHorizontal, Star, User, Video } from 'lucide-react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

export interface SideBarProps {
    compact?: boolean;
}

const SideBar = ({ compact }: SideBarProps) => {
    const { t } = useI18nTranslation('nav');
    const navigate = useNavigate();
    const location = useLocation();
    const videoId = useFile((s) => s.videoId);
    const theme = useSetting((s) => s.values.get('appearance.theme'));
    const item = (
        text: string,
        path: string,
        key: string,
        icon: ReactElement
    ) => {
        const isPlayer = key === 'pa-player';
        const isActive = isPlayer
            ? location.pathname.startsWith('/player')
            : location.pathname.includes(key);
        return (
            <div
                onMouseDown={() => navigate(path)}
                className={cn(
                    'w-full px-2 flex justify-start items-center gap-2 rounded-xl h-10',
                    isActive
                        ? 'bg-zinc-100 drop-shadow dark:bg-neutral-900 shadow-white shadow-inner dark:shadow-none'
                        : 'hover:bg-stone-300 dark:hover:bg-neutral-800',
                    compact && 'justify-center'
                )}
            >
                {cloneElement(icon, {
                    className: cn('w-5 h-5 text-yellow-600 text-yellow-500 flex-shrink-0')
                })}
                {!compact && (
                    <div className={cn('text-base text-foreground  truncate w-0 flex-1')}>
                        {text}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={cn('w-full h-full flex flex-col text-black ')}>
            <div
                className={cn(
                    'flex-1 flex items-center justify-center min-h-fit py-10'
                )}
            >
                <img
                    className={cn(
                        'w-24 h-24 user-drag-none',
                        compact && 'w-14 h-14'
                    )}
                    src={theme === 'dark' ? logoDark : logoLight}
                />
            </div>
            <div className={cn('basis-3/4 flex flex-col p-3 gap-1')}>
                {/* {item('Home', '/home', 'home', <HiOutlineHome />)} */}
                {item(
                    t('playbackLab'),
                    `/player/${videoId}?sideBarAnimation=false`,
                    'pa-player',
                    <Video />
                )}
                {item(
                    t('savedMoments'),
                    '/favorite',
                    'favorite',
                    <Star />
                )}
                {item(
                    t('subtitleWorkspace'),
                    '/transcript',
                    'transcript',
                    <Captions />
                )}
                {item(
                    t('sentenceSplitter'),
                    '/split',
                    'split',
                    <SquareSplitHorizontal />
                )}
                {item(
                    t('formatConverter'),
                    '/convert',
                    'convert',
                    <Rotate3D />
                )}
                {item(
                    t('vocabularyStudio'),
                    '/vocabulary',
                    'vocabulary',
                    <BookOpen />
                )}
                {item(t('settingsCenter'), '/settings', 'settings', <Settings />)}
                {item(t('productStory'), '/about', 'about', <User />)}
            </div>
        </div>
    );
};

SideBar.defaultProps = {
    compact: false
};

export default SideBar;
