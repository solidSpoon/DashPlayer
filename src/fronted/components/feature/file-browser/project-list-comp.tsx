import React from 'react';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { cn } from '@/fronted/lib/utils';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const logger = getRendererLogger('ProjectListComp');

export interface ProjectListCompProps {
    projEle: (p: WatchHistoryVO, handleClick: () => void) => React.JSX.Element;
    videoEle: (p: WatchHistoryVO) => React.JSX.Element;
    backEle?: (root: boolean, currentPath: string, handleClick: () => void) => React.JSX.Element;
    className?: string;
    enterProj?: string;
}

const api = backendClient;


const ProjectListComp = ({ className, videoEle, projEle, backEle, enterProj = '' }: ProjectListCompProps) => {
    const [basePath, setBasePath] = React.useState<string|null>(null);
    const finalPath = basePath ?? enterProj;
    logger.debug('Project list final path', { finalPath });
    const { data: basicData } = useSWR(
        [apiPath('watch-history/list/basic'), finalPath],
        ([p, bp]) => api.call('watch-history/list/basic', bp)
    );
    const [fullData, setFullData] = React.useState<typeof basicData>(undefined);
    const data = fullData ?? basicData;
    const isRoot = StrUtil.isBlank(finalPath);
    React.useEffect(() => {
        let cancelled = false;
        setFullData(undefined);
        const idleId = window.requestIdleCallback(() => {
            api.call('watch-history/list', finalPath)
                .then((result) => {
                    if (!cancelled) {
                        setFullData(result);
                    }
                })
                .catch((error) => {
                    logger.warn('failed to load full watch history list', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                });
        }, { timeout: 1500 });

        return () => {
            cancelled = true;
            window.cancelIdleCallback(idleId);
        };
    }, [finalPath]);
    const backNode = backEle?.(isRoot, finalPath, () => {
        setBasePath('');
    });
    return (
        <div className={cn('flex flex-col', className)}>
            <div className={cn('h-0 flex-1 overflow-y-auto scrollbar-none flex flex-col')}>
                {backNode && (
                    <div className="mb-2">
                        {backNode}
                    </div>
                )}
                {isRoot && data?.map((item) => {
                    const handleClick = () => {
                        if (item.isFolder) {
                            setBasePath(item.basePath);
                        }
                    };
                    return React.cloneElement(projEle(item, handleClick), { key: item.id });
                })}
                {!isRoot && data?.map((item) => {
                    return React.cloneElement(videoEle(item), { key: item.id });
                })}
            </div>
        </div>
    );
};
ProjectListComp.defaultProps = {
    className: '',
    backEle: () => <></>
};

export default ProjectListComp;
