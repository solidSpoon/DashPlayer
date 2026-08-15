import React from 'react';
import {
    SliderInput,
    Title,
} from '@/fronted/pages/setting/components/form';
import ThemePreview from '@/fronted/pages/setting/components/ThemePreview';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { cn } from '@/fronted/lib/utils';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useForm } from 'react-hook-form';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { applyLanguageSetting } from '@/fronted/i18n';
import { useAutoSaveSettingsForm } from '@/fronted/hooks/useAutoSaveSettingsForm';
import useSWR from 'swr';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';

const logger = getRendererLogger('AppearanceSetting');
const api = backendClient;

type AppearanceFormValues = AppearanceSettingVO;

/**
 * 外观设置页：通过 detail 接口加载，自动保存到 save 接口。
 */
const AppearanceSetting = () => {
    const { t } = useI18nTranslation('settings');

    const { data: settings } = useSWR<AppearanceSettingVO>('settings/appearance/detail', () =>
        api.call('settings/appearance/detail'),
    );

    const form = useForm<AppearanceFormValues>();
    const { watch, setValue } = form;

    const { ready, initialize, flush } = useAutoSaveSettingsForm<AppearanceFormValues>({
        form,
        onSave: async (values) => {
            logger.debug('saving appearance settings', { values });
            await api.call('settings/appearance/save', values);
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
            <div className="w-full h-full min-h-0">
                <SettingsPageShell
                    title={t('appearance.title')}
                    description={t('appearance.description')}
                    contentClassName="space-y-8"
                >
                    <></>
                </SettingsPageShell>
            </div>
        );
    }

    const currentTheme = watch('theme');
    const currentFontSize = watch('fontSize');
    const currentLanguage = watch('language');

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
                contentClassName="space-y-8"
            >
                <Title title={t('appearance.themeTitle')} description={t('appearance.themeDescription')} />
                <div className="px-3 py-2 h-60 flex-shrink-0 flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                    {['dark', 'light'].map((themeOption) => {
                        return (
                            <div
                                key={themeOption}
                                className={cn('h-full flex flex-col gap-2 cursor-pointer')}
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
                                <div
                                    className={cn(
                                        'p-1 h-full rounded-lg',
                                        currentTheme === themeOption
                                            ? 'border-2 border-primary'
                                            : 'border-2 border-secondary'
                                    )}
                                >
                                    <ThemePreview
                                        theme={themeOption}
                                        className={cn(
                                            `${themeOption} w-80 flex-1 flex-shrink-0 rounded overflow-hidden h-full`
                                        )}
                                    />
                                </div>
                                <div className="text-center">{themeOption}</div>
                            </div>
                        );
                    })}
                </div>
                <Title title={t('appearance.fontSizeTitle')} description={t('appearance.fontSizeDescription')} />
                <SliderInput
                    title={t('appearance.fontSizeLabel')}
                    values={['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge']}
                    valueLabelMap={fontSizeOptions}
                    defaultValue={currentFontSize}
                    inputWidth="w-56"
                    setValue={(v) => {
                        if (v === 'fontSizeSmall') {
                            setValue('fontSize', 'fontSizeSmall', { shouldDirty: true, shouldTouch: true });
                        }
                        if (v === 'fontSizeMedium') {
                            setValue('fontSize', 'fontSizeMedium', { shouldDirty: true, shouldTouch: true });
                        }
                        if (v === 'fontSizeLarge') {
                            setValue('fontSize', 'fontSizeLarge', { shouldDirty: true, shouldTouch: true });
                        }
                    }}
                />
                <div className="space-y-3">
                    <div>
                        <h1 className="text-lg font-bold mb-2">{t('appearance.languageTitle')}</h1>
                        <p className="text-base text-gray-600">{t('appearance.languageDescription')}</p>
                    </div>
                    <div className="max-w-sm">
                        <Label className="mb-2 block">{t('appearance.languageTitle')}</Label>
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
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('appearance.languageSystem')}</SelectItem>
                                <SelectItem value="zh-CN">{t('appearance.languageZhCN')}</SelectItem>
                                <SelectItem value="en-US">{t('appearance.languageEnUS')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </SettingsPageShell>
        </form>
    );
};

export default AppearanceSetting;
