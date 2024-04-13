import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSystem from '@/fronted/hooks/useSystem';
import TitleBar from '@/fronted/components/TitleBar/TitleBar';
import useSetting from '@/fronted/hooks/useSetting';
import { cn } from '@/common/utils/Util';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import logoLight from '../../../assets/logo-light.png';
import logoDark from '../../../assets/logo-dark.png';
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/hooks/useFile';
import ProjectList from '@/fronted/components/fileBrowserNew/project-list';

const api = window.electron;
const HomePage = () => {
    const navigate = useNavigate();
    const changeSideBar = useLayout((s) => s.changeSideBar);

    async function handleClickById(projectId: number) {
        const project = await api.call('watch-project/detail', projectId);
        let video = project.videos.find((v) => v.current_playing);
        if (!video && project.videos.length > 0) {
            video = project.videos[0];
        }
        if (!video) {
            return;
        }
        const videoId = video.id;
        await api.playerSize();
        changeSideBar(false);
        navigate(`/player/${videoId}`);
    }

    const [searchParams, setSearchParams] = useSearchParams();
    const appVersion = useSystem((s) => s.appVersion);
    const dark = useSetting((s) => s.values.get('appearance.theme')) === 'dark';
    const clear = useFile((s) => s.clear);
    useEffect(() => {
        api.homeSize();
        clear();
    }, [clear]);
    return (
        <div
            className={cn(
                'w-full h-screen flex-1 flex justify-center items-center select-none overflow-hidden text-black/80',
                'bg-slate-200',
                'dark:bg-neutral-800 dark:text-white/80'
            )}
        >
            <TitleBar
                maximizable={false}
                className="fixed top-0 left-0 w-full z-50"
            />
            <div
                className={cn(
                    'w-1/3 h-full backdrop-blur flex flex-col justify-center items-center bg-white/20 gap-14 drop-shadow shadow-white',
                    'dark:shadow-black'
                )}
            >
                <div className="relative top-0 left-0 w-32 h-32">
                    <img
                        src={dark ? logoDark : logoLight}
                        alt="logo"
                        className="w-32 h-32 absolute top-0 left-0 user-drag-none"
                    />
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                    <h2
                        className={cn(
                            'text-lg text-black/80',
                            dark && 'text-white/80'
                        )}
                    >
                        DashPlayer
                    </h2>
                    <text
                        className={cn('text-black/75', dark && 'text-white/75')}
                    >
                        {appVersion}
                    </text>
                </div>
                <div className="w-full h-16" />
            </div>
            <div
                className={cn(
                    'h-full flex-1 backdrop-blur w-0 flex flex-col justify-center items-center bg-stone-200 border-l border-stone-400 pl-8 pr-10 gap-6',
                    'dark:border-neutral-800 dark:bg-white/10'
                )}
            >
                <div className="w-full h-10" />
                <div className={cn('flex w-full flex-col items-start')}>
                    <FileSelector className={cn('text-sm')} />
                    <FileSelector className={cn('text-sm')} directory />
                </div>
                {searchParams.get('browserProjectId') ? (

                    <div>{searchParams.get('browserProjectId')}</div>
                ) : (
                    <ProjectList className={cn('h-0 flex-1 w-full')}
                                 onSelected={async (projectId) => {
                                     await handleClickById(projectId);
                                 }} />
                )}
            </div>
        </div>
    );
};

export default HomePage;
