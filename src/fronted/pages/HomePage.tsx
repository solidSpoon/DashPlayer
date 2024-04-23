import React, {useEffect} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import useSystem from '@/fronted/hooks/useSystem';
import TitleBar from '@/fronted/components/TitleBar/TitleBar';
import useSetting from '@/fronted/hooks/useSetting';
import {cn} from '@/common/utils/Util';
import logoLight from '../../../assets/logo-light.png';
import logoDark from '../../../assets/logo-dark.png';
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/hooks/useFile';
import ProjectListItem from '@/fronted/components/fileBowser/project-list-item';
import FileSelector from '@/fronted/components/fileBowser/FileSelector';
import FileItem from '@/fronted/components/fileBowser/FileItem';
import FolderSelector from '@/fronted/components/fileBowser/FolderSelecter';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import {Input} from "@/fronted/components/ui/input";
import {Button} from "@/fronted/components/ui/button";
import {Checkbox} from "@/fronted/components/ui/checkbox";
import FolderSelecter from "@/fronted/components/fileBowser/FolderSelecter";
import useSWR from "swr";
import {SWR_KEY} from "@/fronted/lib/swr-util";

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

    const {data: vps, mutate} = useSWR(SWR_KEY.WATCH_PROJECT_LIST, () => api.call('watch-project/list', null));
    const appVersion = useSystem((s) => s.appVersion);
    const dark = useSetting((s) => s.values.get('appearance.theme')) === 'dark';
    const clear = useFile((s) => s.clear);
    useEffect(() => {
        api.homeSize().then();
        clear();
    }, [clear]);
    return (
        <div className="flex h-screen w-full flex-col text-foreground">
            <header className="sticky top-0 flex h-9 items-center gap-4 bg-muted/40 px-4 md:px-6">
                <TitleBar
                    maximizable={false}
                    className="fixed top-0 left-0 w-full z-50 h-full"
                />
            </header>
            <main
                className="flex h-0 flex-1 gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">


                    <nav
                        className="grid gap-4 text-sm text-muted-foreground" x-chunk="dashboard-04-chunk-0"
                    >
                        <div className="mx-auto grid gap-2">
                            <h1 className="text-3xl font-semibold">DashPlayer</h1>
                        </div>
                        <Link to="#" className="font-semibold text-primary">
                            General
                        </Link>
                        {/*<Button asChild>*/}
                        <Link to={"#"}>Security</Link>
                        {/*</Button>*/}
                        {/*<Link href="#">Integrations</Link>*/}
                        {/*<Link href="#">Support</Link>*/}
                        {/*<Link href="#">Organizations</Link>*/}
                        {/*<Link href="#">Advanced</Link>*/}
                    </nav>
                    <div className="flex flex-col gap-6 overflow-y-auto scrollbar-none">
                        <div
                            className={cn('justify-self-end flex mb-10 flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                        >
                            <FileSelector
                                onSelected={async (vid) => {
                                    await api.playerSize();
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
                            <FolderSelecter
                                onSelected={async (vid) => {
                                    await api.playerSize();
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

                        <Card x-chunk="dashboard-04-chunk-1 " className={''}>
                            <CardHeader>
                                <CardTitle>Recent Watch</CardTitle>
                                <CardDescription>
                                    Used to identify your store in the marketplace.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className={'grid grid-cols-3 gap-8'}>
                                {vps?.map((v) => (
                                    <ProjectListItem proj={v}/>
                                ))}
                            </CardContent>
                            {/*<CardFooter className="border-t px-6 py-4">*/}
                            {/*    <Button>Save</Button>*/}
                            {/*</CardFooter>*/}
                        </Card>
                    </div>
            </main>
        </div>
        // <div
        //     className={cn(
        //         'w-full h-screen flex-1 flex justify-center items-center select-none overflow-hidden',
        //         'bg-background',
        //         'dark:bg-neutral-800 dark:text-white/80'
        //     )}
        // >
        //     <TitleBar
        //         maximizable={false}
        //         className="fixed top-0 left-0 w-full z-50"
        //     />
        //     <div
        //         className={cn(
        //             'w-1/3 h-full backdrop-blur flex flex-col justify-center items-center bg-white/20 gap-14 shadow-white',
        //             'dark:shadow-black'
        //         )}
        //     >
        //         <div className="relative top-0 left-0 w-32 h-32 border rounded-3xl dark:border-none">
        //             <img
        //                 src={dark ? logoDark : logoLight}
        //                 alt="logo"
        //                 className="w-32 h-32 absolute top-0 left-0 user-drag-none -translate-y-px dark:translate-y-0"
        //             />
        //         </div>
        //         <div className="flex flex-col items-center justify-center gap-2">
        //             <h2
        //                 className={cn(
        //                     'text-lg text-black/80',
        //                     dark && 'text-white/80'
        //                 )}
        //             >
        //                 DashPlayer
        //             </h2>
        //             <text
        //                 className={cn('text-black/75', dark && 'text-white/75')}
        //             >
        //                 {appVersion}
        //             </text>
        //         </div>
        //         <div className="w-full h-16" />
        //     </div>
        //     <div
        //         className={cn(
        //             'h-full flex-1 backdrop-blur w-0 flex flex-col justify-center items-center bg-muted border-l border-stone-200 pl-8 pr-10 gap-6',
        //             'dark:border-neutral-800 dark:bg-white/10'
        //         )}
        //     >
        //         <div className="w-full h-10" />
        //         <div className={cn('flex w-full flex-col items-start')}>
        //             <FileSelector
        //                 onSelected={async (vid) => {
        //                     await api.playerSize();
        //                     changeSideBar(false);
        //                     navigate(`/player/${vid}`);
        //                 }}
        //                 child={(hc) => (
        //                     <FileItem
        //                         content="打开文件..."
        //                         tip="打开文件，可多选（同时选择视频和对应的字幕）"
        //                         className={cn('w-full text-sm')}
        //                         onClick={() => hc()}
        //                     />
        //                 )}
        //             />
        //             <FolderSelector
        //                 onSelected={(vid) => {
        //                     navigate(`/player/${vid}`);
        //                 }}
        //                 child={(hc) => (
        //                     <FileItem
        //                         content="打开文件夹..."
        //                         className={cn('w-full text-sm')}
        //                         onClick={() => hc()}
        //                     />
        //                 )}
        //             />
        //         </div>
        //         <ProjectList className={cn('h-0 flex-1 w-full')}
        //                      onSelected={async (projectId) => {
        //                          await handleClickById(projectId);
        //                      }} />
        //     </div>
        // </div>
    );
};

export default HomePage;
