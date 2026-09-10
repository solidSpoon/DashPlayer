import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/fronted/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/fronted/components/ui/alert-dialog';
import TitleBar from '@/fronted/components/layout/TitleBar/TitleBar';
import { AlertTriangle, Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { MigrationFailureDetail } from '@/common/contracts/migration-failure';
import {
    resetAndRelaunch,
    retryAfterMigrationFailure,
} from './migrationFailureApi';

export interface MigrationFailureGateProps {
    /** 本次启动的迁移失败详情；来自 migration-failure/detail。 */
    failure: MigrationFailureDetail;
}

/** 复制到剪贴板的通用动作；失败时提示但不中断。 */
const useCopyText = () => {
    const [copied, setCopied] = useState(false);
    const copy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // 剪贴板不可用（如无焦点）时静默：用户可直接手动选择文本复制
        }
    };
    return { copied, copy };
};

/**
 * 迁移失败恢复 gate 页。
 *
 * 启动迁移失败时替代主界面：展示失败点与原因，引导用户「重试」或
 * 「重置并重试」。重置是有损操作（清除全部设置与本地数据库），必须
 * 经过确认弹窗；重置/重试成功时窗口会被后端重启，页面停在加载态即可。
 */
export const MigrationFailureGate: React.FC<MigrationFailureGateProps> = ({ failure }) => {
    const { t } = useI18nTranslation('migration');
    const [acting, setActing] = useState<'retry' | 'reset' | null>(null);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const { copied, copy } = useCopyText();

    /** 失败详情的纯文本形态，供用户复制反馈。 */
    const detailText = [
        failure.phase ? `phase: ${failure.phase}` : null,
        failure.migrationId ? `migration: ${failure.migrationId}` : null,
        failure.errorMessage ? `error: ${failure.errorMessage}` : null,
    ].filter(Boolean).join('\n');

    const handleRetry = async () => {
        setActing('retry');
        setResetError(null);
        try {
            await retryAfterMigrationFailure();
        } catch (error) {
            setActing(null);
            toast.error(t('retryFailed'));
            void error;
        }
    };

    const handleReset = async () => {
        setActing('reset');
        setResetError(null);
        try {
            await resetAndRelaunch();
            // 成功时后端会延迟重启，保持重置中展示直到窗口销毁。
        } catch (error) {
            setActing(null);
            setResetError(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground select-none">
            <header className="relative z-20 flex h-9 shrink-0 items-center">
                <TitleBar maximizable={false} className="top-0 left-0 w-full h-9 z-50" />
            </header>

            <main className="relative z-10 flex flex-1 items-center justify-center px-8 pb-10">
                <div className="flex w-full max-w-lg flex-col items-center gap-7 text-center">
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-500">
                        <span className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl" aria-hidden="true" />
                        <AlertTriangle className="relative h-7 w-7" />
                    </span>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">{t('desc')}</p>
                    </div>

                    <div className="w-full space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">{t('detailLabel')}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => { void copy(detailText); }}
                            >
                                <Copy className="h-3 w-3" />
                                {copied ? t('copied') : t('copy')}
                            </Button>
                        </div>
                        <pre className="max-h-32 overflow-y-auto scrollbar-none whitespace-pre-wrap break-all rounded-lg border border-border/50 bg-background/60 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                            {detailText}
                        </pre>
                    </div>

                    {resetError && (
                        <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive break-all">
                            {t('resetFailed')}: {resetError}
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-3 sm:flex-row">
                        <Button
                            size="lg"
                            className="h-11 gap-2 rounded-full px-8 text-sm"
                            disabled={acting !== null}
                            onClick={() => { void handleRetry(); }}
                        >
                            {acting === 'retry'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <RefreshCw className="h-4 w-4" />}
                            {acting === 'retry' ? t('retrying') : t('retry')}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-11 gap-2 rounded-full px-8 text-sm"
                            disabled={acting !== null}
                            onClick={() => setResetDialogOpen(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                            {acting === 'reset' ? t('resetting') : t('reset')}
                        </Button>
                    </div>
                </div>
            </main>

            <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('resetConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription className="leading-relaxed">
                            {t('resetConfirmDesc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={acting === 'reset'}>{t('resetConfirmCancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(event) => {
                                event.preventDefault();
                                setResetDialogOpen(false);
                                void handleReset();
                            }}
                        >
                            {t('resetConfirmOk')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default MigrationFailureGate;
