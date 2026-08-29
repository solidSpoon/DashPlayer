import React from 'react';
import {
    SliderInput,
    SettingCard,
    SettingRow,
    SettingsLoadingSkeleton,
} from '@/fronted/features/settings/components/form';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { cn } from '@/fronted/lib/utils';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useForm, useWatch } from 'react-hook-form';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { applyLanguageSetting } from '@/fronted/i18n';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import useSWR from 'swr';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { Globe, Palette, Sliders, Type, Moon, Sun } from 'lucide-react';

const logger = getRendererLogger('AppearanceSetting');
type AppearanceFormValues = AppearanceSettingVO;

/**
 * 外观设置页：通过 detail 接口加载，自动保存到 save 接口。
 */
const AppearanceSetting = () => {
    const { t } = useI18nTranslation('settings');

    const { data: settings } = useSWR<AppearanceSettingVO>('settings/appearance/detail', () =>
        settingsApi.getAppearance(),
    );

    const form = useForm<AppearanceFormValues>();
    const { setValue } = form;
    const [currentTheme, currentFontSize, currentLanguage] = useWatch({
        control: form.control,
        name: ['theme', 'fontSize', 'language'],
    });

    const { ready, initialize, flush } = useAutoSaveSettingsForm<AppearanceFormValues>({
        form,
        onSave: async (values) => {
            logger.debug('saving appearance settings', { values });
            await settingsApi.saveAppearance(values);
        },
    });

    const [previewMode, setPreviewMode] = React.useState<'main' | 'side'>('main');

    React.useEffect(() => {
        if (!settings) {
            return;
        }
        initialize(settings);
    }, [initialize, settings]);

    if (!ready) {
        return (
            <SettingsLoadingSkeleton
                title={t('appearance.title')}
                description={t('appearance.description')}
            />
        );
    }

    if (currentTheme === undefined || currentFontSize === undefined || currentLanguage === undefined) {
        throw new Error('外观设置表单未初始化');
    }

    const fontSizeOptions: Record<AppearanceFormValues['fontSize'], string> = {
        fontSizeSmall: t('appearance.fontSizeSmall'),
        fontSizeMedium: t('appearance.fontSizeMedium'),
        fontSizeLarge: t('appearance.fontSizeLarge'),
    };

    return (
        <form className="w-full h-full min-h-0" onSubmit={(event) => {
            event.preventDefault();
            flush().catch((error) => {
                logger.error('flush appearance settings failed', { error });
            });
        }}>
            <SettingsPageShell
                title={t('appearance.title')}
                description={t('appearance.description')}
                contentClassName="space-y-6"
            >
                {/* 统一的外观偏好卡片 */}
                <SettingCard
                    title={t('appearance.cardTitle')}
                    description={t('appearance.cardDescription')}
                    icon={Palette}
                >
                    {/* 主题风格切换行 */}
                    <SettingRow
                        title={t('appearance.themeTitle')}
                        description={t('appearance.themeDescription')}
                        icon={Palette}
                    >
                        <div className="flex items-center gap-2">
                            {[
                                {
                                    value: 'dark' as const,
                                    label: t('appearance.themeDark'),
                                    icon: Moon,
                                },
                                {
                                    value: 'light' as const,
                                    label: t('appearance.themeLight'),
                                    icon: Sun,
                                },
                            ].map((option) => {
                                const isSelected = currentTheme === option.value;
                                const IconComponent = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setValue('theme', option.value, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                            });
                                        }}
                                        className={cn(
                                            'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer select-none',
                                            isSelected
                                                ? 'border-primary/80 bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20'
                                                : 'border-border/70 bg-card hover:bg-muted/50 hover:border-border text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <IconComponent className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                        <span>{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </SettingRow>

                    {/* 界面语言行 */}
                    <SettingRow
                        title={t('appearance.languageTitle')}
                        description={t('appearance.languageDescription')}
                        icon={Globe}
                    >
                        <Select
                            value={currentLanguage}
                            onValueChange={(value) => {
                                setValue('language', value as AppearanceFormValues['language'], {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                });
                                applyLanguageSetting(value).catch(() => undefined);
                            }}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('appearance.languageSystem')}</SelectItem>
                                <SelectItem value="zh-CN">{t('appearance.languageZhCN')}</SelectItem>
                                <SelectItem value="en-US">{t('appearance.languageEnUS')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    {/* 字幕字号行 */}
                    <SettingRow
                        title={t('appearance.fontSizeTitle')}
                        description={t('appearance.fontSizeDescription')}
                        icon={Type}
                    >
                        <SliderInput
                            values={['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge']}
                            valueLabelMap={fontSizeOptions}
                            defaultValue={currentFontSize}
                            inputWidth="w-56"
                            setValue={(v) => {
                                if (v === 'fontSizeSmall' || v === 'fontSizeMedium' || v === 'fontSizeLarge') {
                                    setValue('fontSize', v, { shouldDirty: true, shouldTouch: true });
                                }
                            }}
                        />
                    </SettingRow>

                    {/* 实时字幕预览区域：清晰标注为“效果预览” */}
                    <div className="p-5 bg-muted/20 border-t border-border/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                                    {t('appearance.subtitlePreviewTitle')}
                                </span>
                                <span className="text-[11px] text-muted-foreground/60">
                                    {t('appearance.subtitlePreviewHint')}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-muted/60 dark:bg-neutral-800/80 border border-border/60">
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('main')}
                                    className={cn(
                                        'px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                                        previewMode === 'main'
                                            ? 'bg-background text-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {t('appearance.subtitlePreviewMain')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('side')}
                                    className={cn(
                                        'px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                                        previewMode === 'side'
                                            ? 'bg-background text-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {t('appearance.subtitlePreviewSide')}
                                </button>
                            </div>
                        </div>

                        {previewMode === 'main' ? (
                            /* 主字幕全宽视口 */
                            <div className="w-full rounded-2xl border border-border/70 bg-gradient-to-b from-background/90 to-background/50 p-6 shadow-xs flex flex-col items-center justify-center text-center gap-3 transition-all duration-200">
                                <div className={cn(
                                    'font-medium tracking-normal text-stone-800 dark:text-neutral-200 transition-all duration-150 leading-snug',
                                    currentFontSize === 'fontSizeSmall' && 'text-xl',
                                    (!currentFontSize || currentFontSize === 'fontSizeMedium') && 'text-2xl',
                                    currentFontSize === 'fontSizeLarge' && 'text-3xl'
                                )}>
                                    Every <span className="text-emerald-700 dark:text-emerald-400 font-medium underline decoration-emerald-500/50 decoration-[1.5px] underline-offset-[0.22em] rounded px-0.5">journey</span> begins with a single bold step.
                                </div>
                                <div className={cn(
                                    'font-normal tracking-wide text-stone-500 dark:text-neutral-400 transition-all duration-150 leading-relaxed',
                                    currentFontSize === 'fontSizeSmall' && 'text-lg',
                                    (!currentFontSize || currentFontSize === 'fontSizeMedium') && 'text-xl',
                                    currentFontSize === 'fontSizeLarge' && 'text-2xl'
                                )}>
                                    每一个伟大的旅程，都始于勇敢迈出的第一步。
                                </div>
                            </div>
                        ) : (
                            /* 侧边字幕卡片视口：模拟播放器右侧栏真实卡片体验 */
                            <div className="w-full rounded-2xl border border-border/70 bg-stone-200/40 dark:bg-neutral-900/40 p-6 shadow-xs flex flex-col items-center justify-center transition-all duration-200">
                                <div className="w-full max-w-md rounded-xl border border-stone-200/80 dark:border-neutral-700/80 bg-stone-50 dark:bg-neutral-800 p-4 shadow-xs text-center">
                                    <div className={cn(
                                        'font-normal tracking-normal text-stone-950 dark:text-white transition-all duration-150 leading-snug',
                                        currentFontSize === 'fontSizeSmall' && 'text-[14.5px]',
                                        (!currentFontSize || currentFontSize === 'fontSizeMedium') && 'text-[16px]',
                                        currentFontSize === 'fontSizeLarge' && 'text-[18px]'
                                    )}>
                                        Every <span className="text-emerald-700 dark:text-emerald-400 font-medium underline decoration-emerald-500/50 decoration-[1.5px] underline-offset-[0.22em] rounded px-0.5">journey</span> begins with a single bold step.
                                    </div>
                                    <div className={cn(
                                        'mt-2 font-normal text-stone-600 dark:text-neutral-300 transition-all duration-150 leading-normal',
                                        currentFontSize === 'fontSizeSmall' && 'text-[12.5px]',
                                        (!currentFontSize || currentFontSize === 'fontSizeMedium') && 'text-[14px]',
                                        currentFontSize === 'fontSizeLarge' && 'text-[15.5px]'
                                    )}>
                                        每一个伟大的旅程，都始于勇敢迈出的第一步。
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default AppearanceSetting;
