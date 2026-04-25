import React, { useState } from 'react';
import useDownload from '@/fronted/hooks/useDownload';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import { Card } from '@/fronted/components/ui/card';
import { Progress } from '@/fronted/components/ui/progress';
import { Download, Link as LinkIcon, AlertCircle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { DownloadMetadata } from '@/backend/application/ports/gateways/media/DownloadGateway';
import { toast } from 'sonner';
import { cn } from '@/fronted/lib/utils';
import { useNavigate } from 'react-router-dom';

const DownloadItem = ({ task }: { task: any }) => {
    const { t } = useTranslation('pages');
    const navigate = useNavigate();

    return (
        <Card className="p-4 flex flex-col gap-3 bg-muted/30">
            <div className="flex gap-4 items-start">
                {task.thumbnail ? (
                    <img src={task.thumbnail} className="w-32 h-20 object-cover rounded-lg shadow-sm" alt="" />
                ) : (
                    <div className="w-32 h-20 bg-muted rounded-lg flex items-center justify-center">
                        <Download className="text-muted-foreground/30" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate" title={task.title}>{task.title}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-1">Source: {task.url}</p>
                    <div className="mt-2 flex items-center gap-3">
                        <span className="text-[10px] font-medium uppercase px-2 py-0.5 bg-background rounded-full border">
                            {t(`videoDownload.status.${task.status}`)}
                        </span>
                        {task.speed && <span className="text-[10px] text-muted-foreground">Speed: {task.speed}</span>}
                        {task.eta && <span className="text-[10px] text-muted-foreground">ETA: {task.eta}</span>}
                    </div>
                </div>
                {task.status === 'done' && (
                    <Button 
                        size="icon" 
                        variant="secondary"
                        className="rounded-full shrink-0" 
                        onClick={() => navigate(`/player?filePath=${encodeURIComponent(task.savePath)}`)}
                    >
                        <Play size={16} fill="currentColor" />
                    </Button>
                )}
            </div>
            
            {task.status === 'downloading' && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium">
                        <span>Progress</span>
                        <span>{Math.round(task.percent)}%</span>
                    </div>
                    <Progress value={task.percent} className="h-1.5" />
                </div>
            )}
        </Card>
    );
};

const DownloadPage = () => {
    const { t } = useTranslation('pages');
    const [url, setUrl] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [metadata, setMetadata] = useState<DownloadMetadata | null>(null);

    const { tasks, startDownload, getMetadata, clearTasks } = useDownload(useShallow(state => ({
        tasks: Array.from(state.tasks.values()).reverse(),
        startDownload: state.startDownload,
        getMetadata: state.getMetadata,
        clearTasks: state.clearTasks,
    })));

    const handleParse = async () => {
        if (!url) return;
        setIsParsing(true);
        setMetadata(null);
        try {
            const data = await getMetadata(url);
            setMetadata(data);
        } catch (e: any) {
            toast.error(`Parse failed: ${e.message}`);
        } finally {
            setIsParsing(false);
        }
    };

    const handleDownload = async () => {
        if (!metadata) return;
        try {
            await startDownload(metadata.url, undefined, metadata);
            toast.success('Download task added');
            setMetadata(null);
            setUrl('');
        } catch (e: any) {
            toast.error(`Download start failed: ${e.message}`);
        }
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden bg-background text-foreground">
            <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <PageHeader
                    title={t('videoDownload.title')}
                    description={t('videoDownload.description')}
                />
                <div className="mt-6 flex gap-2">
                    <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input
                            className="pl-10 h-10 rounded-xl"
                            placeholder={t('videoDownload.inputPlaceholder')}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleParse()}
                        />
                    </div>
                    <Button 
                        disabled={!url || isParsing} 
                        className="h-10 px-6 rounded-xl"
                        onClick={handleParse}
                    >
                        {isParsing ? (
                            <><Loader2 className="mr-2 animate-spin" size={16} /> {t('videoDownload.parsing')}</>
                        ) : t('videoDownload.parse')}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
                {metadata && (
                    <Card className="p-6 mb-8 border-primary/20 bg-primary/5 rounded-2xl">
                        <div className="flex gap-6 items-start">
                            {metadata.thumbnail ? (
                                <img src={metadata.thumbnail} className="w-48 aspect-video object-cover rounded-xl shadow-lg" alt="" />
                            ) : (
                                <div className="w-48 aspect-video bg-muted rounded-xl" />
                            )}
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold leading-tight">{metadata.title}</h2>
                                    {metadata.duration && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Duration: {Math.floor(metadata.duration / 60)}:{(metadata.duration % 60).toString().padStart(2, '0')}
                                        </p>
                                    )}
                                </div>
                                <Button onClick={handleDownload} className="rounded-full px-8 shadow-xl hover:shadow-primary/20 transition-all">
                                    <Download className="mr-2" size={18} />
                                    {t('videoDownload.download')}
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold opacity-70 uppercase tracking-wider">
                            {tasks.length > 0 ? 'Active Tasks' : t('videoDownload.empty.title')}
                        </h3>
                        {tasks.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearTasks} className="text-xs text-muted-foreground hover:text-destructive">
                                Clear All
                            </Button>
                        )}
                    </div>

                    {tasks.length === 0 && !metadata && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
                            <Download size={48} strokeWidth={1} />
                            <p className="mt-4 text-sm font-medium">{t('videoDownload.empty.guide')}</p>
                        </div>
                    )}

                    <div className="grid gap-3">
                        {tasks.map(task => (
                            <DownloadItem key={task.id} task={task} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadPage;
