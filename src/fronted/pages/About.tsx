import React from 'react';
import {
    ExternalLink,
    FileText,
    Tag,
} from 'lucide-react';

/**
 * GitHub 品牌图标：lucide-react v1.0 起移除了全部品牌图标，这里内联官方 mark SVG。
 */
const GithubIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
);
import { Button } from '@/fronted/components/ui/button';
import logoLight from '../../../assets/logo-light.png';
import logoDark from '../../../assets/logo-dark.png';
import useSWR from 'swr';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSetting from '@/fronted/features/settings/settingsStore';

const api = backendClient;

const About = () => {
    const { t } = useTranslation('settings');
    const navigate = useNavigate();
    const theme = useSetting((s) => s.values.get('appearance.theme'));

    const { data: appVersion } = useSWR(
        'system/app-version',
        () => api.call('system/app-version'),
        { fallbackData: '0.0.0' }
    );

    const openUrl = async (url: string) => {
        try {
            await api.call('system/open-url', url);
        } catch {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="h-full w-full select-none overflow-hidden rounded-2xl bg-card text-foreground flex flex-col">
            {/* 内容区域：大屏优雅居中，小屏安全滚动 */}
            <div className="flex-1 overflow-y-auto px-6 py-10 flex flex-col justify-center items-center min-h-0">
                <div className="max-w-2xl w-full mx-auto my-auto flex flex-col items-center text-center space-y-8 py-6">
                    {/* App 图标 */}
                    <div className="relative">
                        <div className="w-24 h-24 rounded-3xl border border-border/80 bg-background/90 p-3 shadow-md flex items-center justify-center transition-transform hover:scale-105">
                            <img
                                src={theme === 'dark' ? logoDark : logoLight}
                                alt="DashPlayer Logo"
                                className="w-full h-full object-contain select-none"
                                draggable={false}
                            />
                        </div>
                    </div>

                    {/* 产品标题与版本（DashPlayer 严格水平居中） */}
                    <div className="space-y-2.5 w-full flex flex-col items-center">
                        <div className="relative inline-flex items-center justify-center">
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif text-foreground">
                                DashPlayer
                            </h1>
                            <span className="absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary border border-primary/20">
                                v{appVersion}
                            </span>
                        </div>
                        <p className="text-base font-medium text-foreground/80">
                            {t('about.slogan')}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                            {t('about.description')}
                        </p>
                    </div>

                    {/* 快捷操作与外链按钮 */}
                    <div className="flex items-center gap-3 flex-wrap justify-center pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUrl('https://solidspoon.xyz/DashPlayer/home.html')}
                            className="gap-1.5 h-9 px-4 text-xs font-medium"
                        >
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {t('about.links.docs')}
                            <ExternalLink className="w-3 h-3 text-muted-foreground ml-0.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUrl('https://github.com/solidSpoon/DashPlayer')}
                            className="gap-1.5 h-9 px-4 text-xs font-medium"
                        >
                            <GithubIcon className="w-4 h-4 text-muted-foreground" />
                            {t('about.links.github')}
                            <ExternalLink className="w-3 h-3 text-muted-foreground ml-0.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/settings/update')}
                            className="gap-1.5 h-9 px-4 text-xs font-medium"
                        >
                            <Tag className="w-4 h-4 text-muted-foreground" />
                            {t('about.links.releases')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* 底部极简 Footer */}
            <footer className="shrink-0 border-t border-border/50 py-4 px-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <span>{t('about.footer')}</span>
                <span>·</span>
                <span>MIT License</span>
            </footer>
        </div>
    );
};

export default About;
