import React, {useEffect} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import TitleBar from '@/fronted/components/TitleBar/TitleBar';
import {cn} from "@/fronted/lib/utils";
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/hooks/useFile';
import ProjectListCard from '@/fronted/components/fileBowser/project-list-card';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import {Button} from "@/fronted/components/ui/button";
import FolderSelector from "@/fronted/components/fileBowser/FolderSelector";
import useSWR from "swr";
import {SWR_KEY} from "@/fronted/lib/swr-util";
import ProjectListItem from '@/fronted/components/fileBowser/project-list-item';
import {ChevronsDown} from "lucide-react";

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
        await api.call('system/window-size/change', 'player');
        changeSideBar(false);
        navigate(`/player/${videoId}`);
    }

    const {data: vps} = useSWR(SWR_KEY.WATCH_PROJECT_LIST, () => api.call('watch-project/list', null));
    const clear = useFile((s) => s.clear);
    const [num, setNum] = React.useState(4);
    // 从第四个开始截取num个
    const rest = vps?.slice(3, num + 3);
    useEffect(() => {
        api.call('system/window-size/change', 'home').then();
        clear();
    }, [clear]);
    console.log('vpsl', vps?.length, rest?.length, num)
    return (
        <div className="flex h-screen w-full flex-col text-foreground bg-muted/40">
            <header className="top-0 flex h-9 items-center">
                <TitleBar
                    maximizable={false}
                    className="top-0 left-0 w-full h-9 z-50"
                />
            </header>
            <main
                className="flex h-0 flex-1 gap-4 p-4 md:gap-8">


                <nav
                    className="flex flex-col gap-4 text-sm text-muted-foreground font-semibold md:p-10 md:pr-0"
                >
                    <h1 className="text-3xl font-semibold -translate-x-1">DashPlayer</h1>
                    <Link
                        onClick={() => api.call('system/window-size/change', 'player')}
                        to="/home" className="font-semibold text-primary mt-28 text-base ">
                        Home Page
                    </Link>
                    <Link onClick={() => api.call('system/window-size/change', 'player')} to="/split" className="font-semibold ">
                        Split Video
                    </Link>
                    <Link onClick={() => api.call('system/window-size/change', 'player')} to={"/transcript"}
                          className="font-semibold ">Transcript</Link>
                    <Link onClick={() => api.call('system/window-size/change', 'player')} to={"/download"}
                          className="font-semibold ">Download</Link>
                </nav>
                <div className="flex flex-col overflow-y-auto scrollbar-none md:p-10 md:pl-0 w-0 flex-1">
                    <div
                        className={cn('justify-self-end flex flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                    >
                        <FileSelector
                            onSelected={async (vid) => {
                                await api.call('system/window-size/change', 'player');
                                changeSideBar(false);
                                navigate(`/player/${vid}`);
                            }}
                            child={(hc) => (
                                <Button
                                    onClick={() => hc()}
                                    variant={'outline'}
                                    className={cn('w-28')}
                                >Open File</Button>
                            )}
                        />
                        <FolderSelector
                            onSelected={async (vid) => {
                                await api.call('system/window-size/change', 'player');
                                changeSideBar(false);
                                navigate(`/player/${vid}`);
                            }}
                            child={(hc) => (
                                <Button
                                    onClick={() => hc()}
                                    variant={'outline'}
                                    className={cn('w-28')}
                                >Open Folder</Button>
                            )}
                        />
                    </div>

                    <Card x-chunk="dashboard-04-chunk-1" className={'mt-16 '}>
                        <CardHeader>
                            <CardTitle>Recent Watch</CardTitle>
                            <CardDescription>
                                Pick up where you left off
                            </CardDescription>
                        </CardHeader>
                        <CardContent className={'grid grid-cols-3 gap-8'}>
                            {vps?.slice(0, 3)
                                .map((v) => (
                                    <ProjectListCard
                                        key={v.id}
                                        onSelected={() => handleClickById(v.id)}
                                        proj={v}/>
                                ))}
                        </CardContent>
                    </Card>
                    <div className={'flex flex-col mt-10'}>
                        {rest?.map((v) => (
                            <ProjectListItem
                                key={v.id}
                                onSelected={() => handleClickById(v.id)}
                                proj={v}/>
                        ))}
                    </div>
                    <Button
                        onClick={() => setNum(num + 10)}
                        disabled={num + 3 >= (vps?.length ?? 0)}
                        variant={'ghost'}>
                        <ChevronsDown className={'text-muted-foreground'}/>
                    </Button>
                </div>
            </main>
        </div>
    );
};

export default HomePage;
