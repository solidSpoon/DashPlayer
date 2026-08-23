import React from 'react';
import {
    ExternalLink,
    FileText,
    Github,
    Tag,
} from 'lucide-react';
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
        <div className="h-full w-full select-none overflow-hidden rounded-2xl border border-border/70 bg-card text-foreground flex flex-col">
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
                            <Github className="w-4 h-4 text-muted-foreground" />
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
