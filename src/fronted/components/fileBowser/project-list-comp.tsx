import React from 'react';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { cn } from '@/fronted/lib/utils';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator
} from '@/fronted/components/ui/breadcrumb';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import StrUtil from '@/common/utils/str-util';
import PathUtil from '@/common/utils/PathUtil';

export interface ProjectListCompProps {
    projEle: (p: WatchHistoryVO, handleClick: () => void) => React.JSX.Element;
    videoEle: (p: WatchHistoryVO) => React.JSX.Element;
    backEle?: (root: boolean, handleClick: () => void) => React.JSX.Element;
    className?: string;
    enterProj?: string;
}

const api = window.electron;


const ProjectListComp = ({ className, videoEle, projEle, backEle, enterProj = '' }: ProjectListCompProps) => {
    const [basePath, setBasePath] = React.useState<string>(enterProj);
    const { data } = useSWR([apiPath('watch-history/list'), basePath], ([p, bp]) => api.call('watch-history/list', bp), { fallbackData: [] });
    console.log('data', enterProj);
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <Breadcrumb className={cn('')}>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            onClick={() => {
                                setBasePath('');
                            }}
                        >Recent</BreadcrumbLink>
                        {StrUtil.isNotBlank(basePath) && <>
                            <BreadcrumbSeparator />
                            <BreadcrumbLink>{PathUtil.parse(basePath).base}</BreadcrumbLink>
                        </>}
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <div className={cn('h-0 flex-1 overflow-y-auto scrollbar-none')}>
                {backEle?.(StrUtil.isBlank(basePath) , () => {
                    setBasePath('');
                })}
                {StrUtil.isBlank(basePath) && data.map((item, idx) => {
                    const handleClick = () => {
                        if (item.isFolder) {
                            setBasePath(item.basePath);
                        }
                    };
                    return projEle(item, handleClick);
                })}
                {StrUtil.isNotBlank(basePath) && data.map((item, idx) => {
                    return videoEle(item);
                })}
            </div>
        </div>
    );
};
ProjectListComp.defaultProps = {
    className: '',
    backEle: () => {
        return <></>;
    }
};

export default ProjectListComp;
