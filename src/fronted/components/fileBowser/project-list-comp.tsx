import React from 'react';
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
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import PathUtil from '@/common/utils/PathUtil';

export interface ProjectListCompProps {
    projEle: (p: WatchHistoryVO, handleClick: () => void) => React.JSX.Element;
    videoEle: (p: WatchHistoryVO) => React.JSX.Element;
    backEle?: (root: boolean, handleClick: () => void) => React.JSX.Element;
    className?: string;
    enterProj?: string | null;
}

const api = window.electron;
const listFetcher = () => api.call('watch-history/list');
const detailFetcher =async ([_key, basePath]: [string, string]) => {
    return (await api.call('watch-history/list', basePath));
};

const ProjectDetailList = ({videoEle, videoPath}: {
    videoEle: (p: WatchHistoryVO) => React.JSX.Element;
    videoPath: string;
}) => {
    const basePath = PathUtil.parse(videoPath).dir;
    const {
        data
    } = useSWR([SWR_KEY.WATCH_PROJECT_DETAIL, basePath], detailFetcher, {fallbackData: []});
    return <> {data.map((item) => videoEle(item))}</>;
};


const ProjectListComp = ({className, videoEle, projEle, backEle, enterProj = null}: ProjectListCompProps) => {
    const {data} = useSWR(SWR_KEY.WATCH_PROJECT_LIST, listFetcher, {fallbackData: []});
    console.log('data', data,enterProj);
    const [basePath, setBasePath] = React.useState<string>('');
    // useEffect(() => {
    //     if (enterProj !== null) {
    //         const item = data.find((item) => item.id === enterProj);
    //         if (item && item.isFolder) {
    //             setProjId(item.id);
    //             setProjName(item.project_name);
    //         }
    //     }
    // }, [data, enterProj]);
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
                        {enterProj && <>
                            <BreadcrumbSeparator/>
                            <BreadcrumbLink>{enterProj}</BreadcrumbLink>
                        </>}
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <div className={cn('h-0 flex-1 overflow-y-auto scrollbar-none')}>
                {/* {backEle?.(StrUtil.isBlank(projId) , () => { */}
                {/*     setProjId(null); */}
                {/*     setProjName(''); */}
                {/* })} */}
                {enterProj === null && data.map((item, idx) => {
                    console.log('ininininin');
                    const handleClick = () => {
                        if (item.isFolder) {
                            // setProjId(item.id);
                            // setProjName(item.project_name);
                        }
                    };
                    return projEle(item, handleClick);
                })}
                {enterProj !== null && <ProjectDetailList videoEle={videoEle} videoPath={enterProj}/>}
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
