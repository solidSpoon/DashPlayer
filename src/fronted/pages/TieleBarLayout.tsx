import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import {cn} from "@/fronted/lib/utils";
import TitleBar from '@/fronted/components/layout/TitleBar/TitleBar';
import { useTranslation } from 'react-i18next';

const TitleBarLayout = () => {
    const { t } = useTranslation('common');
    return (
        <div
            className={cn(
                'w-full h-screen bg-stone-200 flex flex-col font-face-arc overflow-hidden select-none',
                'dark:bg-neutral-700'
            )}
        >
            <TitleBar className="" />
            <Suspense fallback={<div>{t('loading')}</div>}>
                <div className={cn('flex-1 h-0 w-full')}>
                    <Outlet />
                </div>
            </Suspense>
        </div>
    );
};
export default TitleBarLayout;
