'use client';

import {IconOpenAI, IconUser} from '@/fronted/pages/player/chat/icons';
import {spinner} from './spinner';
import Md from './markdown';
import {cn} from '@/fronted/lib/utils';
import {number} from "zod";

export function UserMessage({children}: { children: string }) {
    return (
        <div className="group relative flex items-start">
            <div
                className="flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border bg-background shadow-sm">
                <IconUser/>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden pl-2">
                <Md>
                    {children}
                </Md>
            </div>
        </div>
    );
}

export function BotMessage({
                               children,
                               className
                           }: {
    children: string
    className?: string
}) {
    return (
        <div className={cn('group relative flex items-start', className)}>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI/>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
                <Md>
                    {children}
                </Md>
            </div>
        </div>
    );
}

export function SystemMessageBox({children}: { children: React.ReactNode }) {
    return (
        <div
            className={
                'mt-2 flex items-center justify-center gap-2 text-xs text-gray-500'
            }
        >
            <div className={'max-w-[600px] flex-initial p-2'}>{children}</div>
        </div>
    );
}

export function SpinnerMessage() {
    return (
        <div className="group relative flex items-start md:-ml-12">
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI/>
            </div>
            <div className="ml-4 h-[24px] flex flex-row items-center flex-1 space-y-2 overflow-hidden px-1">
                {spinner}
            </div>
        </div>
    );
}
