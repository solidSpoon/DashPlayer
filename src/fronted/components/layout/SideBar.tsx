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

import { Reorder } from 'framer-motion';
import { useNavigationStore } from '@/fronted/hooks/useNavigation';
import { NavItem } from '@/fronted/config/navigation';

const SideBar = ({ compact }: SideBarProps) => {
    const { t } = useI18nTranslation('nav');
    const navigate = useNavigate();
    const location = useLocation();
    const videoId = useFile((s) => s.videoId);
    const theme = useSetting((s) => s.values.get('appearance.theme'));
    const { orderedItems, setOrderedItems } = useNavigationStore();

    const renderItem = (
        text: string,
        path: string,
        key: string,
        icon: React.ReactNode
    ) => {
        const isPlayer = key === 'pa-player';
        const isActive = isPlayer
            ? location.pathname.startsWith('/player')
            : location.pathname.includes(key);
        return (
            <div
                onClick={() => navigate(path)}
                className={cn(
                    'w-full px-2 flex justify-start items-center gap-2 rounded-xl h-10 select-none cursor-grab active:cursor-grabbing',
                    isActive
                        ? 'bg-zinc-100 drop-shadow dark:bg-neutral-900 shadow-white shadow-inner dark:shadow-none'
                        : 'hover:bg-stone-300 dark:hover:bg-neutral-800',
                    compact && 'justify-center'
                )}
            >
                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, {
                    className: cn('w-5 h-5 text-yellow-600 text-yellow-500 flex-shrink-0')
                }) : icon}
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
            <Reorder.Group
                axis="y"
                values={orderedItems}
                onReorder={setOrderedItems}
                className={cn('basis-3/4 flex flex-col p-3 gap-1 list-none')}
            >
                {orderedItems.map((navItem: NavItem) => {
                    const finalPath = navItem.id === 'pa-player' 
                        ? `/player/${videoId}?sideBarAnimation=false`
                        : navItem.path;
                    
                    return (
                        <Reorder.Item
                            key={navItem.id}
                            value={navItem}
                            drag={!compact} // Compact mode might be too small for easy drag
                        >
                            {renderItem(
                                t(navItem.label),
                                finalPath,
                                navItem.id,
                                navItem.icon
                            )}
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>
        </div>
    );
};

SideBar.defaultProps = {
    compact: false
};

export default SideBar;
