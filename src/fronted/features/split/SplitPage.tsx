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
            <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <PageHeader
                    title={t('sentenceSplitter.title')}
                    description={t('sentenceSplitter.description')}
                />
            </div>

            <div className={cn(
                'flex-1 min-h-0 grid gap-6 px-6 py-5 overflow-hidden',
                '[grid-template-columns:minmax(0,1fr)_minmax(0,1.2fr)]'
            )}>
                {/* 左栏：章节输入、文件选择和辅助操作。 */}
                <div className="flex min-w-0 flex-col gap-4 min-h-0">
                    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('sentenceSplitter.inputLabel')}
                        </Label>
                        <Textarea
                            disabled={!inputable}
                            value={userInput}
                            onChange={e => setUseInput(e.target.value)}
                            placeholder={t('sentenceSplitter.inputPlaceholder')}
                            className="flex-1 resize-none font-mono text-sm"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('sentenceSplitter.filesLabel')}
                        </Label>
                        <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2.5">
                            <div className="flex items-center gap-2.5">
                                <FileVideo2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                                {video?.baseName ? <>
                                    <span className="flex-1 text-sm truncate">{video.baseName}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-5 h-5 shrink-0"
                                        onClick={() => {
                                            if (!videoPath) {
                                                throw new Error('视频路径不存在，无法从切分队列移除');
                                            }
                                            deleteFile(videoPath);
                                        }}
                                    ><X className="w-3 h-3" /></Button>
                                </> : <span
                                    className="text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                    onClick={onSelect}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            void onSelect();
                                        }
                                    }}
                                >{t('sentenceSplitter.clickToSelect')}</span>}
                            </div>
                            <div className="flex items-center gap-2.5">
                                <FileType2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                                {srt?.baseName ? <>
                                    <span className="flex-1 text-sm truncate">{srt.baseName}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-5 h-5 shrink-0"
                                        onClick={() => {
                                            if (!srtPath) {
                                                throw new Error('字幕路径不存在，无法从切分队列移除');
                                            }
                                            deleteFile(srtPath);
                                        }}
                                    ><X className="w-3 h-3" /></Button>
                                </> : <span
                                    className="text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                    onClick={onSelect}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            void onSelect();
                                        }
                                    }}
                                >{t('sentenceSplitter.clickToSelect')}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setUseInput(example.trim())}
                                    ><FileQuestion className="w-4 h-4" /></Button>
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
                                        size="icon"
                                    ><Stethoscope className="w-4 h-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('sentenceSplitter.aiFormat')}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* 右栏：切分预览、快速选择和执行入口。 */}
                <div className="flex min-w-0 flex-col gap-3 min-h-0">
                    <Tabs
                        defaultValue="preview"
                        className="flex min-w-0 flex-col flex-1 min-h-0"
                    >
                        <TabsList className="grid w-full grid-cols-2 shrink-0">
                            <TabsTrigger value="preview">{t('sentenceSplitter.tabs.preview')}</TabsTrigger>
                            <TabsTrigger value="quickSelect">{t('sentenceSplitter.tabs.quickSelect')}</TabsTrigger>
                        </TabsList>
                        <TabsContent
                            value="preview"
                            className="mt-2 min-w-0 flex-1 overflow-auto scrollbar-thin"
                        >
                            <SplitPreview className="w-full" />
                        </TabsContent>
                        <TabsContent
                            value="quickSelect"
                            className="mt-2 min-w-0 flex-1 overflow-y-auto"
                        >
                            <SplitFile />
                        </TabsContent>
                    </Tabs>

                    <div className="flex gap-2 justify-end shrink-0">
                        <Button variant="secondary" onClick={onSelect}>
                            {t('sentenceSplitter.selectFile')}
                        </Button>
                        <Button
                            disabled={spliting}
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
                        >{t('sentenceSplitter.splitAll')}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default SplitPage;
