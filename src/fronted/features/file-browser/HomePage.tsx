import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TitleBar from '@/fronted/components/layout/TitleBar/TitleBar';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/features/file-browser/fileStore';
import ProjectListCard from '@/fronted/features/file-browser/components/project-list-card';
import { Button } from '@/fronted/components/ui/button';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import ProjectListItem from '@/fronted/features/file-browser/components/project-list-item';
import {
    BookOpen,
    Captions,
    ChevronsDown,
    Clock,
    Film,
    FolderOpen,
    PlayCircle,
    Rotate3D,
    Scissors,
    Settings,
    Star
} from 'lucide-react';
import FolderSelector, { FolderSelectAction } from '@/fronted/features/file-browser/components/FolderSelector';
import FileSelector, { FileAction } from '@/fronted/features/file-browser/components/FileSelector';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { fileBrowserApi } from '@/fronted/features/file-browser/fileBrowserApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const logger = getRendererLogger('HomePage');

const HomePage = () => {
    const { t } = useI18nTranslation('nav');
    const { t: tc } = useI18nTranslation('common');
    const navigate = useNavigate();
    const changeSideBar = useLayout((s) => s.changeSideBar);

    async function handleClickById(vId: string) {
        await fileBrowserApi.changeWindowSize('player');
        changeSideBar(false);
        navigate(`/player/${vId}`);
    }

    const { data: vpsBasic } = useSWR(apiPath('watch-history/list/basic'), fileBrowserApi.listBasicWatchHistory);
    const [vpsFull, setVpsFull] = React.useState<typeof vpsBasic>(undefined);
    const vps = vpsFull ?? vpsBasic;
    const clear = useFile((s) => s.clear);
    const [num, setNum] = React.useState(4);
    // 从第四个开始截取num个
    const rest = vps?.slice(3, num + 3);

    useEffect(() => {
        fileBrowserApi.changeWindowSize('home').then();
        clear();
    }, [clear]);

    useEffect(() => {
        let cancelled = false;
        let idleId: number | null = null;

        const loadFullList = async () => {
            try {
                const full = await fileBrowserApi.listWatchHistory();
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

    const navItems = [
        { title: t('savedMoments'), path: '/favorite', icon: Star },
        { title: t('subtitleWorkspace'), path: '/transcript', icon: Captions },
        { title: t('sentenceSplitter'), path: '/split', icon: Scissors },
        { title: t('formatConverter'), path: '/convert', icon: Rotate3D },
        { title: t('vocabularyStudio'), path: '/vocabulary', icon: BookOpen },
        { title: t('settingsCenter'), path: '/settings', icon: Settings },
    ];

    const hasHistory = vps && vps.length > 0;

    return (
        <div className="flex h-screen w-full flex-col text-foreground bg-background select-none">
            <header className="top-0 flex h-9 items-center shrink-0">
                <TitleBar
                    maximizable={false}
                    className="top-0 left-0 w-full h-9 z-50"
                />
            </header>
            <main className="flex h-0 flex-1 gap-10 pl-8 pr-12 pb-6 pt-6 overflow-hidden">
                {/* 左侧导航栏 */}
                <nav className="w-52 shrink-0 flex flex-col justify-between py-1">
                    <div className="flex flex-col gap-6">
                        <div className="px-3 pt-1">
                            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                                DashPlayer
                            </h1>
                        </div>

                        <div className="flex flex-col gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        onClick={() => fileBrowserApi.changeWindowSize('player')}
                                        to={item.path}
                                        className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all duration-150"
                                    >
                                        <Icon className="h-4 w-4 stroke-[1.8] text-muted-foreground/80 group-hover:text-primary transition-colors shrink-0" />
                                        <span>{item.title}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>

                {/* 右侧内容流 */}
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto scrollbar-none px-2 pr-6">
                    {/* 有播放历史时的布局 */}
                    {hasHistory ? (
                        <div className="flex flex-col gap-8 pb-8">
                            {/* 顶部快速打开区域：简洁优雅的圆角栏 */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 px-6 rounded-2xl border border-border/70 bg-card shadow-2xs">
                                <div className="flex flex-col gap-0.5 text-center sm:text-left">
                                    <span className="text-sm font-semibold text-foreground">快速开始播放</span>
                                    <span className="text-xs text-muted-foreground">选择音视频及对应字幕文件，或直接打开媒体文件夹</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="w-36">
                                        <FileSelector
                                            onSelected={FileAction.playerAction2(navigate)}
                                            withMkv
                                        />
                                    </div>
                                    <div className="w-36">
                                        <FolderSelector
                                            onSelected={FolderSelectAction.defaultAction2(async (vid) => {
                                                await fileBrowserApi.changeWindowSize('player');
                                                changeSideBar(false);
                                                navigate(`/player/${vid}`);
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 最近观看区 */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <h2 className="text-sm font-semibold text-foreground">{tc('recentWatch')}</h2>
                                    </div>
                                    <span className="text-xs text-muted-foreground/80">{tc('pickUpWhereLeftOff')}</span>
                                </div>

                                {/* 自动流式网格：每张卡片保持最小 240px、最大 1fr 宽度，少卡片时自适应且不空洞 */}
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
                                    {vps?.slice(0, 3).map((v) => (
                                        <ProjectListCard
                                            key={v.id}
                                            onSelected={() => handleClickById(v.id)}
                                            video={v}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* 历史记录列表区 */}
                            {rest && rest.length > 0 && (
                                <div className="flex flex-col gap-2 pt-2">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tc('earlierRecords', { defaultValue: '更早记录' })}</h3>
                                    </div>
                                    <div className="flex flex-col divide-y divide-border/40">
                                        {rest.map((v) => (
                                            <ProjectListItem
                                                key={v.id}
                                                onSelected={() => handleClickById(v.id)}
                                                video={v}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {vps && (num + 3 < vps.length) && (
                                <div className="flex justify-center pt-1">
                                    <Button
                                        onClick={() => setNum(num + 10)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-4 rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1"
                                    >
                                        <span>{tc('loadMore', { defaultValue: '加载更多' })}</span>
                                        <ChevronsDown className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 无播放历史时的专属初始场景 (Empty State) */
                        <div className="flex flex-col items-center justify-center h-full min-h-[420px] text-center p-8">
                            <div className="flex flex-col items-center max-w-md w-full">
                                <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-xs">
                                    <PlayCircle className="h-8 w-8 stroke-[1.75]" />
                                </div>
                                <h2 className="text-lg font-semibold text-foreground mb-1.5">
                                    {tc('emptyWatchTitle', { defaultValue: '开启你的音视频学习之旅' })}
                                </h2>
                                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                                    {tc('emptyWatchDesc', { defaultValue: '选择本地音视频文件（支持外挂字幕），或直接导入整个媒体文件夹开始播放与学习' })}
                                </p>
                                
                                <div className="flex items-center gap-3 w-full justify-center">
                                    <div className="w-36">
                                        <FileSelector
                                            onSelected={FileAction.playerAction2(navigate)}
                                            withMkv
                                        />
                                    </div>
                                    <div className="w-36">
                                        <FolderSelector
                                            onSelected={FolderSelectAction.defaultAction2(async (vid) => {
                                                await fileBrowserApi.changeWindowSize('player');
                                                changeSideBar(false);
                                                navigate(`/player/${vid}`);
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default HomePage;
