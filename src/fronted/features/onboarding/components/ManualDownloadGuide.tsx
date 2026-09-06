import React from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Copy, ExternalLink, FolderOpen, HelpCircle } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { settingsApi } from '@/fronted/features/settings/settingsApi';

/** 手动下载指南的展示参数。 */
interface ManualDownloadGuideProps {
    /** 模型文件的官方下载地址。 */
    url: string;
    /** 用户应将文件保存到的目标路径。 */
    path: string;
    /** 第三步的收尾说明文案（归档模型与 GGUF 模型不同）。 */
    footerText: string;
    /** 提供时在第三步展示「重新扫描」按钮（GGUF 手动放入场景）。 */
    onRescan?: () => void;
}

/**
 * 网络不稳定时的手动下载与安装指南（折叠面板）。
 *
 * 与设置页的指引保持同一流程：下载文件（复制链接 / 浏览器打开）→
 * 保存到指定路径（复制路径 / 打开文件夹）→ 回到应用完成安装。
 */
const ManualDownloadGuide = ({ url, path, footerText, onRescan }: ManualDownloadGuideProps) => {
    const { t } = useTranslation('onboarding');
    const [open, setOpen] = React.useState(false);

    /** 复制文本到剪贴板；失败时显式报错。 */
    const copyText = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('manual.copied'));
        } catch (error) {
            toast.error(`${t('manual.copyFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /** 在系统默认浏览器中打开下载地址。 */
    const openInBrowser = async () => {
        try {
            await settingsApi.openUrl(url);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    /** 打开目标文件所在文件夹。 */
    const openFolder = async () => {
        try {
            await settingsApi.openFolderForFile(path);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {t('manual.toggle')}
                </span>
                {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {open && (
                <div className="p-3.5 pt-2 space-y-3.5 text-xs border-t border-border/40 text-muted-foreground">
                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('manual.step1Title')}</div>
                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                            <div className="text-muted-foreground/70">{url}</div>
                            <div className="flex items-center gap-2 pt-1 font-sans">
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(url)}>
                                    <Copy className="w-3 h-3 mr-1" />
                                    {t('manual.copyUrl')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openInBrowser()}>
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    {t('manual.openInBrowser')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('manual.step2Title')}</div>
                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                            <div className="text-muted-foreground/70">{path}</div>
                            <div className="flex items-center gap-2 pt-1 font-sans">
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(path)}>
                                    <Copy className="w-3 h-3 mr-1" />
                                    {t('manual.copyPath')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openFolder()}>
                                    <FolderOpen className="w-3 h-3 mr-1" />
                                    {t('manual.openFolder')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 bg-muted/30 p-2 rounded">
                        <div className="space-y-0.5 text-muted-foreground/90">
                            <span className="font-semibold text-foreground">{t('manual.step3Title')}</span>
                            <span>{footerText}</span>
                        </div>
                        {onRescan && (
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onRescan()}>
                                {t('manual.rescan')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualDownloadGuide;
