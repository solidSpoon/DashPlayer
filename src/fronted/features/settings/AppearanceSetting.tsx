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
                        <div className="w-64">
                            <SliderInput
                                title={t('appearance.fontSizeLabel')}
                                values={['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge']}
                                valueLabelMap={fontSizeOptions}
                                defaultValue={currentFontSize}
                                inputWidth="w-full"
                                setValue={(v) => {
                                    if (v === 'fontSizeSmall' || v === 'fontSizeMedium' || v === 'fontSizeLarge') {
                                        setValue('fontSize', v, { shouldDirty: true, shouldTouch: true });
                                    }
                                }}
                            />
                        </div>
                    </SettingRow>
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default AppearanceSetting;
