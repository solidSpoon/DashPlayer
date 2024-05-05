import React from 'react';
import {WatchProject, WatchProjectType} from '@/backend/db/tables/watchProjects';
import {WatchProjectVideo} from '@/backend/db/tables/watchProjectVideos';
import useSWR from 'swr';
import {SWR_KEY} from '@/fronted/lib/swr-util';
import {cn} from '@/fronted/lib/utils';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator
} from '@/fronted/components/ui/breadcrumb';

export interface ProjectListCompProps {
    projEle: (p: WatchProject, handleClick: () => void) => React.JSX.Element;
    videoEle: (p: WatchProjectVideo) => React.JSX.Element;
    backEle?: (root: boolean, handleClick: () => void) => React.JSX.Element;
    className?: string;
}

const api = window.electron;
const listFetcher = () => api.call('watch-project/list', null);
const detailFetcher =async ([_key, projId]: [string, number]) => {
    return (await api.call('watch-project/detail', projId)).videos;
};

const ProjectDetailList = ({videoEle, projId}: {
    videoEle: (p: WatchProjectVideo) => React.JSX.Element;
    projId: number;
}) => {
    const {
        data
    } = useSWR([SWR_KEY.WATCH_PROJECT_DETAIL, projId], detailFetcher, {fallbackData: []});
    return <> {data.map((item) => videoEle(item))}</>;
};


const ProjectListComp = ({className, videoEle, projEle, backEle}: ProjectListCompProps) => {
    const {data} = useSWR(SWR_KEY.WATCH_PROJECT_LIST, listFetcher, {fallbackData: []});
    const [projId, setProjId] = React.useState<number | null>(null);
    const [projName, setProjName] = React.useState<string>('');
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <Breadcrumb className={cn('')}>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            onClick={() => {
                                setProjId(null);
                                setProjName('');
                            }}
                        >Recent</BreadcrumbLink>
                        {projName && <>
                            <BreadcrumbSeparator/>
                            <BreadcrumbLink>{projName}</BreadcrumbLink>
                        </>}
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <div className={cn('h-0 flex-1 overflow-y-auto scrollbar-none')}>
                {backEle(projId === null, () => {
                    setProjId(null);
                    setProjName('');
                })}
                {projId === null && data.map((item, idx) => {
                    const handleClick = () => {
                        if (item.project_type === WatchProjectType.DIRECTORY) {
                            setProjId(item.id);
                            setProjName(item.project_name);
                        }
                    };
                    return projEle(item, handleClick);
                })}
                {projId !== null && <ProjectDetailList videoEle={videoEle} projId={projId}/>}
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
