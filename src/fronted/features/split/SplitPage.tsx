import { cn } from '@/fronted/lib/utils';
import React, { useEffect } from 'react';
import { Button } from '@/fronted/components/ui/button';
import { Textarea } from '@/fronted/components/ui/textarea';
import { Label } from '@/fronted/components/ui/label';
import { FileQuestion, FileType2, FileVideo2, Stethoscope, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/fronted/components/ui/tabs';
import SplitFile from './components/SplitFile';
import SplitPreview from './components/SplitPreview';
import useSplit from './splitStore';
import { useShallow } from 'zustand/react/shallow';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { AllFormats } from '@/common/utils/MediaUtil';
import { splitApi } from './splitApi';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const example = `
00:00:00 Intro
00:01:10 Part 1
00:10:00 Part 2
00:20:00 Part 3
`;

/**
 * 切分长视频页面。
 * 负责组织左右两栏布局，并确保预览区在窄窗口下优先内部滚动，而不是把整页撑出屏幕。
 */
const SplitPage = () => {
    const { t } = useI18nTranslation('pages');
    const {
        userInput,
        setUseInput,
        videoPath,
        srtPath,
        deleteFile,
        updateFile,
        inputable,
        aiFormat,
        runSplitAll
    } = useSplit(useShallow(s => ({
        userInput: s.userInput,
        setUseInput: s.setUseInput,
        videoPath: s.videoPath,
        srtPath: s.srtPath,
        deleteFile: s.deleteFile,
        updateFile: s.updateFile,
        aiFormat: s.aiFormat,
        inputable: s.inputable,
        runSplitAll: s.runSplitAll
    })));
    const { data: video } = useSWR(videoPath ? ['system/select-file', videoPath] : null, ([_key, path]) => splitApi.getPathInfo(path));
    const { data: srt } = useSWR(srtPath ? ['system/select-file', srtPath] : null, ([_key, path]) => splitApi.getPathInfo(path));
    const onSelect = async () => {
        const files = await splitApi.selectFiles(AllFormats);
        files.forEach(updateFile);
    };

    useEffect(() => {
        useSplit.setState({ inputable: true });
    }, []);
    const [spliting, setSpliting] = React.useState(false);

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            {/* 顶栏标题区：无分割线，统一排版 */}
            <div className="px-6 pt-5 pb-2">
                <PageHeader
                    title={t('sentenceSplitter.title')}
                    description={t('sentenceSplitter.description')}
                />
            </div>

            <div className={cn(
                'flex-1 min-h-0 grid gap-5 px-6 pb-5 pt-1 overflow-hidden',
                '[grid-template-columns:minmax(0,1.1fr)_minmax(0,1.4fr)]'
            )}>
                {/* 左栏卡片：章节输入、快捷辅助与目标文件卡片 */}
                <div className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-2xs min-h-0 gap-4">
                    {/* 时间点与章节输入区：作为沉浸式编辑器设计 */}
                    <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex items-center justify-between h-9 shrink-0 mb-2">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold text-foreground tracking-tight">
                                    {t('sentenceSplitter.inputLabel')}
                                </Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => setUseInput(example.trim())}
                                            >
                                                <FileQuestion className="w-3.5 h-3.5 mr-1" />
                                                {t('sentenceSplitter.loadExample')}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('sentenceSplitter.loadExample')}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                onClick={aiFormat}
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-2.5 text-xs font-medium bg-background"
                                            >
                                                <Stethoscope className="w-3.5 h-3.5 mr-1.5 text-primary" />
                                                {t('sentenceSplitter.aiFormat')}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('sentenceSplitter.aiFormat')}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col">
                            <Textarea
                                disabled={!inputable}
                                value={userInput}
                                onChange={e => setUseInput(e.target.value)}
                                placeholder={t('sentenceSplitter.inputPlaceholder')}
                                className="flex-1 resize-none font-mono text-xs md:text-sm leading-relaxed p-0 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none scrollbar-thin placeholder:text-muted-foreground/60"
                            />
                        </div>
                    </div>

                    {/* 已选媒体与字幕文件绑定 */}
                    <div className="flex flex-col gap-2 shrink-0 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-muted-foreground tracking-wide">
                                {t('sentenceSplitter.filesLabel')}
                            </Label>
                            {(!video?.baseName || !srt?.baseName) && (
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-primary font-normal"
                                    onClick={onSelect}
                                >
                                    {t('sentenceSplitter.selectFile')}
                                </Button>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {/* 视频条目 */}
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-muted/40 min-h-9 transition-colors hover:bg-muted/60">
                                <FileVideo2 className="w-4 h-4 shrink-0 text-primary" />
                                {video?.baseName ? (
                                    <>
                                        <span className="flex-1 text-xs font-medium truncate text-foreground" title={video.baseName}>
                                            {video.baseName}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="w-5 h-5 shrink-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                if (!videoPath) {
                                                    throw new Error('视频路径不存在，无法从切分队列移除');
                                                }
                                                deleteFile(videoPath);
                                            }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </>
                                ) : (
                                    <span
                                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                        onClick={onSelect}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                void onSelect();
                                            }
                                        }}
                                    >
                                        {t('sentenceSplitter.clickToSelect')} (视频)
                                    </span>
                                )}
                            </div>

                            {/* 字幕条目 */}
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-muted/40 min-h-9 transition-colors hover:bg-muted/60">
                                <FileType2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                                {srt?.baseName ? (
                                    <>
                                        <span className="flex-1 text-xs font-medium truncate text-foreground" title={srt.baseName}>
                                            {srt.baseName}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="w-5 h-5 shrink-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                if (!srtPath) {
                                                    throw new Error('字幕路径不存在，无法从切分队列移除');
                                                }
                                                deleteFile(srtPath);
                                            }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </>
                                ) : (
                                    <span
                                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                        onClick={onSelect}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                void onSelect();
                                            }
                                        }}
                                    >
                                        {t('sentenceSplitter.clickToSelect')} (字幕)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右栏卡片：切分预览、快速选择与操作卡片 */}
                <div className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-2xs min-h-0 gap-4">
                    <Tabs
                        defaultValue="preview"
                        className="flex min-w-0 flex-col flex-1 min-h-0"
                    >
                        <div className="flex items-center justify-between h-9 shrink-0">
                            <TabsList className="grid w-56 grid-cols-2 h-9">
                                <TabsTrigger value="preview" className="text-xs h-7">
                                    {t('sentenceSplitter.tabs.preview')}
                                </TabsTrigger>
                                <TabsTrigger value="quickSelect" className="text-xs h-7">
                                    {t('sentenceSplitter.tabs.quickSelect')}
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs bg-background" onClick={onSelect}>
                                    {t('sentenceSplitter.selectFile')}
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 text-xs font-medium px-3.5 shadow-xs"
                                    disabled={spliting || !videoPath}
                                    onClick={async () => {
                                        setSpliting(true);
                                        try {
                                            await toast.promise(runSplitAll(), {
                                                loading: t('sentenceSplitter.splitting'),
                                                success: t('sentenceSplitter.splitSuccess'),
                                                error: (v: unknown) => v instanceof Error ? v.message : t('sentenceSplitter.splitFailed')
                                            });
                                        } finally {
                                            setSpliting(false);
                                        }
                                    }}
                                >
                                    {t('sentenceSplitter.splitAll')}
                                </Button>
                            </div>
                        </div>

                        <TabsContent
                            value="preview"
                            className="mt-3 min-w-0 flex-1 overflow-auto scrollbar-thin"
                        >
                            <SplitPreview className="w-full h-full" />
                        </TabsContent>
                        <TabsContent
                            value="quickSelect"
                            className="mt-3 min-w-0 flex-1 overflow-hidden"
                        >
                            <SplitFile />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};
export default SplitPage;
