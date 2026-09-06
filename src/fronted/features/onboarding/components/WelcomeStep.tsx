import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import toast from 'react-hot-toast';

/**
 * 引导第一步：欢迎页，顺手设置界面语言与外观主题。
 *
 * 选择变化时立即保存到后端；保存失败以 toast 显式暴露，不静默吞掉。
 *
 * @param props.appearance 外观设置详情；未加载完成前禁用选择器。
 */
const WelcomeStep = ({ appearance }: { appearance: AppearanceSettingVO | null }) => {
    const { t } = useTranslation('onboarding');

    /**
     * 将单项外观修改与当前详情合并保存。
     *
     * @param patch 要覆盖的字段。
     */
    const saveAppearance = async (patch: Partial<AppearanceSettingVO>) => {
        if (!appearance) {
            return;
        }
        try {
            await settingsApi.saveAppearance({ ...appearance, ...patch });
        } catch (error) {
            toast.error(t('welcome.saveFailed', {
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="items-center text-center">
                <CardTitle className="text-3xl font-bold">{t('title')}</CardTitle>
                <CardDescription className="text-base">{t('subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
                <div className="flex flex-col gap-2 w-64">
                    <Label>{t('welcome.languageLabel')}</Label>
                    <Select
                        value={appearance?.language ?? undefined}
                        onValueChange={(value) => saveAppearance({ language: value as AppearanceSettingVO['language'] })}
                        disabled={!appearance}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="system">{t('welcome.languageSystem')}</SelectItem>
                            <SelectItem value="zh-CN">中文</SelectItem>
                            <SelectItem value="en-US">English</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-2 w-64">
                    <Label>{t('welcome.themeLabel')}</Label>
                    <Select
                        value={appearance?.theme ?? undefined}
                        onValueChange={(value) => saveAppearance({ theme: value as AppearanceSettingVO['theme'] })}
                        disabled={!appearance}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">{t('welcome.themeLight')}</SelectItem>
                            <SelectItem value="dark">{t('welcome.themeDark')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};

export default WelcomeStep;
