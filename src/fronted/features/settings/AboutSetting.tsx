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
    Compass,
    ExternalLink,
    FileText,
    Info,
    RefreshCw,
    Sparkles,
    Tag,
} from 'lucide-react';
import logoLight from '../../../../assets/logo-light.png';
import logoDark from '../../../../assets/logo-dark.png';
import useSetting from '@/fronted/features/settings/settingsStore';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingRow } from '@/fronted/features/settings/components/form/SettingCard';

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
        <SettingsPageShell
            title={t('about.title', { defaultValue: '关于与更新' })}
            description={t('about.slogan', {
                defaultValue: '专为语言学习与长视频精听打造的智能双语播放器',
            })}
            contentClassName="space-y-6 max-w-3xl"
        >
            {/* 核心卡片：应用信息与版本状态 */}
            <div className="rounded-xl border border-border/70 bg-card/50 shadow-xs overflow-hidden">
                {/* 顶部主信息栏 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5">
                    <div className="flex items-center gap-3.5">
                        <img
                            src={theme === 'dark' ? logoDark : logoLight}
                            alt="DashPlayer Logo"
                            className="w-12 h-12 object-contain select-none shrink-0"
                            draggable={false}
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold tracking-tight text-foreground font-serif">
                                    DashPlayer
                                </h2>
                                {currentVersion && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground/80 border border-border">
                                        v{currentVersion}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {t('about.description')}
                            </p>
                        </div>
                    </div>

                    {/* 右侧主操作区 */}
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
                            {t('about.links.releases', { defaultValue: '版本日志' })}
                            <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />
                        </Button>
                    </div>
                </div>

                {/* 状态展开区域 */}
                {checking && !updateResult ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>正在检查更新...</span>
                    </div>
                ) : hasError ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border/50 bg-destructive/5 text-xs text-destructive">
                        <span>{errorText}</span>
                        <Button
                            onClick={() => recheckUpdate()}
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                        >
                            重试
                        </Button>
                    </div>
                ) : hasNewRelease ? (
                    <div className="border-t border-border/50 bg-muted/10 p-4 space-y-2.5">
                        {/* 极简版本提示与下载链接 */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-foreground">
                                    新版本可用
                                </span>
                                <span className="font-mono text-muted-foreground">
                                    {updateResult?.releases[0]?.version}
                                </span>
                            </div>

                            <Button
                                onClick={() => openUrl(updateResult?.releases[0]?.url || 'https://github.com/solidSpoon/DashPlayer/releases/latest')}
                                size="sm"
                                variant="default"
                                className="gap-1 h-7 px-2.5 text-xs font-medium shrink-0"
                            >
                                <ExternalLink className="h-3 w-3" />
                                前往下载新版本
                            </Button>
                        </div>

                        {/* 更新日志正文：仅针对日志内部标题与列表做紧凑覆盖 */}
                        <div className="rounded-md border border-border/70 bg-background/80 p-3 max-h-48 overflow-y-auto scrollbar-thin text-muted-foreground [&_.prose]:max-w-none [&_.prose]:text-xs [&_.prose_*]:my-0.5 [&_.prose_h1]:text-xs [&_.prose_h1]:font-semibold [&_.prose_h1]:text-foreground [&_.prose_h2]:text-xs [&_.prose_h2]:font-semibold [&_.prose_h2]:text-foreground [&_.prose_h3]:text-xs [&_.prose_h3]:font-semibold [&_.prose_h3]:text-foreground [&_.prose_p]:text-xs [&_.prose_p]:leading-relaxed [&_.prose_ul]:text-xs [&_.prose_ul]:my-1 [&_.prose_ul]:pl-4 [&_.prose_li]:my-0.5 [&_.prose_strong]:text-foreground">
                            <Md>
                                {(updateResult?.releases ?? []).map((release) => (
                                    codeBlock`
                                    ${release.content}
                                    `
                                )).join('\n---\n')}
                            </Md>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-4 py-2 border-t border-border/50 bg-muted/10 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{t('about.update.upToDateTitle', { defaultValue: '当前已是最新版本' })}</span>
                    </div>
                )}
            </div>

            {/* 相关资源与开源卡片 */}
            <SettingCard
                title={t('about.resourcesTitle', { defaultValue: '相关资源' })}
                description={t('about.resourcesDescription', { defaultValue: '查阅官方文档、访问开源社区或查看授权协议' })}
                icon={Info}
            >
                <SettingRow
                    title={t('about.links.docs', { defaultValue: '官方文档' })}
                    description={t('about.links.docsDesc', { defaultValue: '查看完整使用教程与快捷键指南' })}
                    icon={FileText}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl('https://solidspoon.xyz/DashPlayer/home.html')}
                        className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                        {t('common.viewDocs', { defaultValue: '查看文档' })}
                        <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />
                    </Button>
                </SettingRow>

                <SettingRow
                    title={t('about.links.github', { defaultValue: 'GitHub 仓库' })}
                    description={t('about.links.githubDesc', { defaultValue: '欢迎提交 Issue、功能建议或给项目点个 Star' })}
                    icon={GithubIcon}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl('https://github.com/solidSpoon/DashPlayer')}
                        className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                        GitHub
                        <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />
                    </Button>
                </SettingRow>

                <SettingRow
                    title={t('about.links.license', { defaultValue: '开源协议' })}
                    description={t('about.links.licenseDesc', { defaultValue: '基于 GNU AGPLv3 自由开源' })}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl('https://github.com/solidSpoon/DashPlayer/blob/main/LICENSE')}
                        className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                        GNU AGPLv3
                        <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />
                    </Button>
                </SettingRow>
            </SettingCard>

            <div className="pt-2 pb-6 text-center text-[11px] text-muted-foreground/60">
                {t('about.footer', { defaultValue: '由 solidSpoon 用心打造' })} · GNU AGPLv3
            </div>
        </SettingsPageShell>
    );
};

export default AboutSetting;
