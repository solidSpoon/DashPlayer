import React from 'react';
import {
    SliderInput,
    SettingCard,
    SettingRow,
    SettingsLoadingSkeleton,
} from '@/fronted/features/settings/components/form';
import ThemePreview from '@/fronted/features/settings/components/ThemePreview';
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
import { Globe, Palette, Sliders, Type } from 'lucide-react';

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
                {/* 主题选择卡片 */}
                <SettingCard
                    title={t('appearance.themeTitle')}
                    description={t('appearance.themeDescription')}
                    icon={Palette}
                >
                    <div className="p-4 flex flex-wrap gap-6 items-center">
                        {['dark', 'light'].map((themeOption) => {
                            const isSelected = currentTheme === themeOption;
                            return (
                                <div
                                    key={themeOption}
                                    className={cn(
                                        'flex flex-col gap-2 cursor-pointer rounded-xl p-2 transition-all border-2',
                                        isSelected
                                            ? 'border-primary bg-primary/5 shadow-xs'
                                            : 'border-border/40 hover:border-border hover:bg-muted/30'
                                    )}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setValue('theme', themeOption as AppearanceFormValues['theme'], {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                            });
                                        }
                                    }}
                                    onClick={() => {
                                        setValue('theme', themeOption as AppearanceFormValues['theme'], {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                        });
                                    }}
                                >
                                    <div className="h-44 w-72 rounded-lg overflow-hidden border border-border/60">
                                        <ThemePreview
                                            theme={themeOption}
                                            className={cn(
                                                `${themeOption} w-full h-full`
                                            )}
                                        />
                                    </div>
                                    <span className="text-center text-xs font-semibold capitalize text-foreground">
                                        {themeOption}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </SettingCard>

                {/* 偏好与排版卡片 */}
                <SettingCard
                    title={t('appearance.displayPreferencesTitle', { defaultValue: '偏好与排版' })}
                    icon={Sliders}
                >
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
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('appearance.languageSystem')}</SelectItem>
                                <SelectItem value="zh-CN">{t('appearance.languageZhCN')}</SelectItem>
                                <SelectItem value="en-US">{t('appearance.languageEnUS')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingRow>

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
