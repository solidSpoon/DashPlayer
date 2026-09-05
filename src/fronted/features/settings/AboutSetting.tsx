import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { codeBlock } from 'common-tags';
import useSWR from 'swr';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { UpdateCheckResult } from '@/common/types/update-check';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import {
    CheckCircle2,
    ExternalLink,
    FileText,
    RefreshCw,
    Sparkles,
    Tag,
} from 'lucide-react';
import logoLight from '../../../../assets/logo-light.png';
import logoDark from '../../../../assets/logo-dark.png';
import useSetting from '@/fronted/features/settings/settingsStore';

/**
 * GitHub 品牌图标（lucide-react 无内置 brand icon，内联标准 SVG）
 */
const GithubIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
);

const AboutSetting = () => {
    const { t } = useI18nTranslation('settings');
    const theme = useSetting((s) => s.values.get('appearance.theme'));

    const { data: currentVersion = '' } = useSWR<string>(
        'system/app-version',
        async () => {
            return await settingsApi.getAppVersion().catch(() => '');
        },
        {
            fallbackData: '',
            revalidateOnFocus: false,
        }
    );

    const {
        data: updateResult,
        isLoading: checking,
        isValidating,
        mutate: recheckUpdate,
    } = useSWR<UpdateCheckResult>(
        'system/check-update',
        async () => {
            return await settingsApi.checkUpdate();
        },
        {
            revalidateOnFocus: false,
        }
    );

    const isCheckingUpdate = checking || isValidating;
    const hasNewRelease = (updateResult?.releases?.length ?? 0) > 0;
    const hasError = updateResult?.status === 'error';

    const errorText = updateResult?.error
        ? t(`about.update.errors.${updateResult.error}`, {
            defaultValue: t(`checkUpdate.errors.${updateResult.error}`, {
                defaultValue: t('about.update.failedDescription', {
                    defaultValue: t('checkUpdate.failedDescription'),
                }),
            }),
        })
        : t('about.update.failedDescription', { defaultValue: t('checkUpdate.failedDescription') });

    const openUrl = async (url: string) => {
        await settingsApi.openUrl(url);
    };

    return (
        <div className="h-full min-h-0 flex flex-col justify-between py-8 px-4 max-w-xl w-full mx-auto scrollbar-thin">
            {/* 中间核心内容区域：居中排列，增加呼吸感 */}
            <div className="flex flex-col items-center my-auto space-y-7 w-full py-4">
                {/* 头部：App Logo、名称、版本、介绍 */}
                <div className="flex flex-col items-center text-center space-y-3.5">
                    <div className="w-20 h-20 rounded-3xl border border-border/80 bg-background/90 p-3.5 shadow-sm flex items-center justify-center transition-transform hover:scale-105">
                        <img
                            src={theme === 'dark' ? logoDark : logoLight}
                            alt="DashPlayer Logo"
                            className="w-full h-full object-contain select-none"
                            draggable={false}
                        />
                    </div>

                    <div className="space-y-1.5 flex flex-col items-center">
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold tracking-tight font-serif text-foreground">
                                DashPlayer
                            </h1>
                            {currentVersion && (
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary border border-primary/20">
                                    v{currentVersion}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-medium text-foreground/80 max-w-md">
                            {t('about.slogan')}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md leading-relaxed pt-0.5">
                            {t('about.description')}
                        </p>
                    </div>
                </div>

                {/* 中间：更新检查与状态卡片 */}
                <div className="w-full rounded-2xl border border-border/70 bg-muted/20 p-5 backdrop-blur-xs shadow-2xs">
                    {checking && !updateResult && (
                        <div className="flex w-full flex-col gap-2.5 py-2">
                            <Skeleton className="w-40 h-5 rounded-md" />
                            <Skeleton className="w-full h-3.5 rounded" />
                            <Skeleton className="w-2/3 h-3.5 rounded" />
                        </div>
                    )}

                    {(!checking || updateResult) && (
                        <div>
                            {hasError ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-destructive">
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-sm">
                                            {t('about.update.failedTitle', { defaultValue: t('checkUpdate.failedTitle') })}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">{errorText}</p>
                                    </div>
                                    <Button
                                        onClick={() => recheckUpdate()}
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-1.5 text-xs self-start sm:self-auto shrink-0"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        {t('about.update.retry', { defaultValue: '重试' })}
                                    </Button>
                                </div>
                            ) : hasNewRelease ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                            <Sparkles className="h-4 w-4" />
                                            <span>
                                                {t('about.update.newVersionFound', { defaultValue: '发现新版本' })}: {updateResult.releases[0]?.version}
                                            </span>
                                        </div>
                                        <Button
                                            onClick={() => openUrl(updateResult.releases[0]?.url || 'https://github.com/solidSpoon/DashPlayer/releases/latest')}
                                            size="sm"
                                            className="gap-1.5 h-8 text-xs font-medium shrink-0"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            {t('about.update.downloadNow', { defaultValue: '前往下载新版本' })}
                                        </Button>
                                    </div>

                                    <div className="rounded-xl border border-border/60 bg-background/80 p-4 text-xs max-h-60 overflow-y-auto scrollbar-thin">
                                        <Md>
                                            {(updateResult?.releases ?? []).map((release) => (
                                                codeBlock`
                                            ## ${release.version}

                                            ${release.content}
                                            `
                                            )).join('\n---\n')}
                                        </Md>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-semibold text-foreground">
                                                {t('about.update.upToDateTitle', { defaultValue: '当前已是最新版本' })}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {t('about.update.upToDateDesc', {
                                                    defaultValue: currentVersion
                                                        ? `DashPlayer v${currentVersion} 运行中，暂无可用更新。`
                                                        : '你的客户端版本已处于最新状态。',
                                                    version: currentVersion,
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            onClick={() => recheckUpdate()}
                                            disabled={isCheckingUpdate}
                                            size="sm"
                                            variant="outline"
                                            className="h-8 gap-1.5 text-xs"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                                            {t('about.update.checkNow', { defaultValue: '检查更新' })}
                                        </Button>
                                        <Button
                                            onClick={() => openUrl('https://github.com/solidSpoon/DashPlayer/releases/latest')}
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            <Tag className="h-3.5 w-3.5" />
                                            {t('about.links.releases', { defaultValue: '发布记录' })}
                                            <ExternalLink className="h-3 w-3 ml-0.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 底部：外链按钮组与 Footer，吸底并留有合适内边距 */}
            <div className="mt-auto pt-6 pb-2 flex flex-col items-center space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl('https://solidspoon.xyz/DashPlayer/home.html')}
                        className="gap-1.5 h-8 px-3 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        {t('about.links.docs', { defaultValue: '官方文档' })}
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl('https://github.com/solidSpoon/DashPlayer')}
                        className="gap-1.5 h-8 px-3 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                        <GithubIcon className="w-3.5 h-3.5" />
                        {t('about.links.github', { defaultValue: 'GitHub 仓库' })}
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl('https://github.com/solidSpoon/DashPlayer/blob/main/LICENSE')}
                        className="gap-1.5 h-8 px-3 text-xs font-normal text-muted-foreground hover:text-foreground"
                    >
                        {t('about.links.license', { defaultValue: 'AGPLv3 协议' })}
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                    </Button>
                </div>

                <p className="text-[11px] text-muted-foreground/60">
                    {t('about.footer', { defaultValue: '由 solidSpoon 用心打造' })} · GNU AGPLv3
                </p>
            </div>
        </div>
    );
};

export default AboutSetting;
