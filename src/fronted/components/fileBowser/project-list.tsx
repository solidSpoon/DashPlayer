import useSWR from 'swr';
import { cn } from '@/common/utils/Util';
import { GoHistory } from 'react-icons/go';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import React from 'react';
import { WatchProjectType } from '@/backend/db/tables/watchProjects';
import { SWR_KEY } from '@/fronted/lib/swr-util';

const api = window.electron;
const fetcher = () => api.call('watch-project/list', null);

export interface ProjectListProps {
    onSelected: (projectId: number) => void;
    className?: string;
}

const ProjectList = ({ onSelected, className }: ProjectListProps) => {
    const { data: vps, mutate } = useSWR(SWR_KEY.WATCH_PROJECT_LIST, fetcher);
    const lastPlay = vps ? (vps.length > 0 ? vps[0] : null) : null;
    const restPlay = vps ? vps.length > 1 ? vps.slice(1) : [] : [];
    return (
        <div className={cn('flex flex-col gap-2',className)}>
            {lastPlay && (
                <div
                    onClick={() => onSelected(lastPlay.id)}
                    className={cn(
                        'w-full bg-black/10 hover:bg-black/20 px-4 h-12 rounded-lg flex items-center justify-start gap-2 text-sm',
                        'dark:bg-white/10 dark:hover:bg-white/20'
                    )}
                >
                    <GoHistory
                        className={cn(
                            'w-4 h-4 fill-neutral-600',
                            'dark:fill-neutral-400'
                        )}
                    />
                    <span>Resume</span>
                    <span className="flex-1 truncate">
                            {lastPlay?.project_name}
                        </span>
                    <span
                        className={cn(
                            'text-neutral-600',
                            'dark:text-neutral-400'
                        )}
                    />
                </div>
            )}
            <div className="w-full flex-1 flex flex-col overflow-y-auto scrollbar-none text-sm">
                {restPlay.map((item) => {
                    return (
                        <FileItem
                            key={item.id}
                            icon={(() => {
                                const file = item.project_type === WatchProjectType.FILE;
                                return file ? 'video' : 'folder';
                            })()}
                            onClick={() => onSelected(item.id)}
                            content={item.project_name}
                        />
                    );
                })}
            </div>
        </div>
    );
};


ProjectList.defaultProps = {
    className: ''
}

export default ProjectList;
