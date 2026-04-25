import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TitleBar from '@/fronted/components/layout/TitleBar/TitleBar';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/hooks/useFile';
import ProjectListCard from '@/fronted/components/feature/file-browser/project-list-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { Button } from '@/fronted/components/ui/button';
import useSWR from 'swr';
import { apiPath, SWR_KEY } from '@/fronted/lib/swr-util';
import ProjectListItem from '@/fronted/components/feature/file-browser/project-list-item';
import { ChevronsDown } from 'lucide-react';
import FolderSelector, { FolderSelectAction } from '@/fronted/components/feature/file-browser/FolderSelector';
import FileSelector, { FileAction } from '@/fronted/components/feature/file-browser/FileSelector';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';

import { Reorder } from 'framer-motion';
import { useNavigationStore } from '@/fronted/hooks/useNavigation';

const logger = getRendererLogger('HomePage');

const HomePage = () => {
    const { t } = useI18nTranslation('nav');
    const navigate = useNavigate();
    const changeSideBar = useLayout((s) => s.changeSideBar);
    const videoId = useFile((s) => s.videoId);
    const { orderedItems, setOrderedItems } = useNavigationStore();

    async function handleClickById(vId: string) {
        await backendClient.call('system/window-size/change', 'player');
        changeSideBar(false);
        navigate(`/player/${vId}`);
    }

    const { data: vpsBasic } = useSWR(apiPath('watch-history/list/basic'), () => backendClient.call('watch-history/list/basic'));
    const [vpsFull, setVpsFull] = React.useState<typeof vpsBasic>(undefined);
    const vps = vpsFull ?? vpsBasic;
    const clear = useFile((s) => s.clear);
    const [num, setNum] = React.useState(4);
    // 从第四个开始截取num个
    const rest = vps?.slice(3, num + 3);
    useEffect(() => {
        backendClient.call('system/window-size/change', 'home').then();
        clear();
    }, [clear]);
    useEffect(() => {
        let cancelled = false;
        let idleId: number | null = null;

        const loadFullList = async () => {
            try {
                const full = await backendClient.call('watch-history/list');
                if (!cancelled) {
                    setVpsFull(full);
                }
            } catch (error) {
                logger.warn('failed to load full watch history list', { error: error instanceof Error ? error.message : String(error) });
            }
        };

        idleId = window.requestIdleCallback(() => {
            void loadFullList();
        }, { timeout: 1500 });

        return () => {
            cancelled = true;
            if (idleId !== null && 'cancelIdleCallback' in window) {
                window.cancelIdleCallback(idleId);
            }
        };
    }, []);
    logger.debug('video project statistics', { vpsCount: vps?.length, restCount: rest?.length, num });
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
                    <div className="mt-28" />
                    <Reorder.Group
                        axis="y"
                        values={orderedItems}
                        onReorder={setOrderedItems}
                        className="flex flex-col gap-4 list-none p-0 m-0 w-full"
                    >
                        {orderedItems.map((item) => (
                            <Reorder.Item
                                key={item.id}
                                value={item}
                                className="cursor-grab active:cursor-grabbing p-2 -mx-2 rounded hover:bg-foreground/5 transition-colors flex items-center select-none gap-3"
                                whileDrag={{ scale: 1.05, opacity: 0.9, backgroundColor: 'var(--accent)' }}
                            >
                                {item.icon && React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, {
                                    className: cn('w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0')
                                }) : item.icon}
                                <Link
                                    onClick={() => backendClient.call('system/window-size/change', 'player')}
                                    to={item.id === 'pa-player' ? `${item.path}/${videoId}?sideBarAnimation=false` : item.path}
                                    draggable={false}
                                    className="font-semibold w-full block pointer-events-auto"
                                >
                                    {t(item.label)}
                                </Link>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </nav>
                <div className="flex flex-col overflow-y-auto scrollbar-none md:p-10 md:pl-0 w-0 flex-1">
                    <div
                        className={cn('justify-self-end flex flex-wrap w-full justify-center items-center gap-2 min-h-20 rounded border border-dashed p-2')}
                    >
                        <FileSelector
                            onSelected={FileAction.playerAction2(navigate)}
                            withMkv
                        />
                        <FolderSelector
                            onSelected={FolderSelectAction.defaultAction2(async (vid, fp) => {
                                await backendClient.call('system/window-size/change', 'player');
                                changeSideBar(false);
                                navigate(`/player/${vid}`);
                            })}
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
                                        video={v} />
                                ))}
                        </CardContent>
                    </Card>
                    <div className={'flex flex-col mt-10'}>
                        {rest?.map((v) => (
                            <ProjectListItem
                                key={v.id}
                                onSelected={() => handleClickById(v.id)}
                                video={v} />
                        ))}
                    </div>
                    <Button
                        onClick={() => setNum(num + 10)}
                        disabled={num + 3 >= (vps?.length ?? 0)}
                        variant={'ghost'}>
                        <ChevronsDown className={'text-muted-foreground'} />
                    </Button>
                </div>
            </main>
        </div>
    );
};

export default HomePage;
