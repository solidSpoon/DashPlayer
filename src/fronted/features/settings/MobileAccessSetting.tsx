import React from 'react';
import useSWR from 'swr';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, Link2, Smartphone, Wifi } from 'lucide-react';

import {
    SettingCard,
    SettingRow,
    SettingsLoadingSkeleton,
} from '@/fronted/features/settings/components/form';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Switch } from '@/fronted/components/ui/switch';
import { cn } from '@/fronted/lib/utils';
import {
    SETTINGS_DETAIL_SWR_OPTIONS,
    settingsApi,
} from '@/fronted/features/settings/settingsApi';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import type { MobileAccessSettingSaveVO } from '@/common/contracts/mobile-access-setting-vo';

type MobileAccessFormValues = MobileAccessSettingSaveVO;

/** 端口输入的合法范围。 */
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * 校验端口文本。
 *
 * @param text 用户输入的端口文本。
 * @returns 合法时返回数字，否则返回 null。
 */
const parsePort = (text: string): number | null => {
    if (!/^\d+$/.test(text)) {
        return null;
    }
    const value = Number.parseInt(text, 10);
    if (!Number.isInteger(value) || value < MIN_PORT || value > MAX_PORT) {
        return null;
    }
    return value;
};

/**
 * 手机访问设置页。
 *
 * 保存端口会真正重启监听服务，因此端口输入采用「失焦后提交」：输入过程中只改本地
 * 文本，避免每敲一位都触发一次重启和一次失败提示。开关仍然沿用设置页的自动保存。
 */
const MobileAccessSetting = () => {
    const { t } = useI18nTranslation('settings');
    const { data: detail, error: loadError, mutate } = useSWR(
        'settings/mobile-access/detail',
        () => settingsApi.getMobileAccess(),
        SETTINGS_DETAIL_SWR_OPTIONS,
    );

    const form = useForm<MobileAccessFormValues>();
    const { setValue } = form;
    const [enabled, port] = useWatch({
        control: form.control,
        name: ['enabled', 'port'],
    });

    const { ready, error: saveError, initialize } = useAutoSaveSettingsForm<MobileAccessFormValues>({
        form,
        detailKey: 'settings/mobile-access/detail',
        onSave: async (values) => {
            await settingsApi.saveMobileAccess(values);
        },
    });

    const [portText, setPortText] = React.useState('');
    const [portError, setPortError] = React.useState<string | null>(null);
    const portFocusedRef = React.useRef(false);

    React.useEffect(() => {
        if (!detail) {
            return;
        }
        initialize({
            enabled: detail.enabled,
            port: detail.port,
        });
    }, [detail, initialize]);

    React.useEffect(() => {
        if (portFocusedRef.current) {
            return;
        }
        setPortText(port === undefined ? '' : String(port));
        setPortError(null);
    }, [port]);

    /**
     * 复制地址到剪贴板。
     *
     * @param value 待复制的文本。
     */
    const copyText = async (value: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('mobile.copied'));
        } catch (copyError) {
            toast.error(copyError instanceof Error ? copyError.message : String(copyError));
        }
    };

    /**
     * 用系统浏览器打开地址。
     *
     * @param url 待打开的地址。
     */
    const openUrl = async (url: string): Promise<void> => {
        try {
            await settingsApi.openUrl(url);
        } catch (openError) {
            toast.error(openError instanceof Error ? openError.message : String(openError));
        }
    };

    if (loadError && !detail) {
        return (
            <SettingsPageShell title={t('mobile.title')} description={t('mobile.description')}>
                <div
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                    {loadError instanceof Error ? loadError.message : String(loadError)}
                </div>
            </SettingsPageShell>
        );
    }

    if (!ready || enabled === undefined || port === undefined || !detail) {
        return (
            <SettingsLoadingSkeleton
                title={t('mobile.title')}
                description={t('mobile.description')}
            />
        );
    }

    const errorText = saveError ?? detail.lastError;
    const statusText = detail.running
        ? t('mobile.statusRunning')
        : detail.lastError
            ? t('mobile.statusFailed')
            : detail.enabled
                ? t('mobile.statusNotRunning')
                : t('mobile.statusStopped');

    /**
     * 端口输入失焦时提交。
     */
    const commitPort = (): void => {
        portFocusedRef.current = false;
        const nextPort = parsePort(portText);
        if (nextPort === null) {
            setPortError(t('mobile.portInvalid'));
            return;
        }
        setPortError(null);
        setPortText(String(nextPort));
        if (nextPort !== port) {
            setValue('port', nextPort, { shouldDirty: true, shouldTouch: true });
        }
    };

    /**
     * 渲染一行可复制、可打开的地址。
     *
     * @param url 访问地址。
     */
    const renderUrl = (url: string) => (
        <div
            key={url}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
        >
            <span className="min-w-0 select-text break-all font-mono text-xs text-foreground/90">
                {url}
            </span>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={t('mobile.copy')}
                    aria-label={t('mobile.copy')}
                    onClick={() => {
                        copyText(url).catch(() => undefined);
                    }}
                >
                    <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={t('mobile.open')}
                    aria-label={t('mobile.open')}
                    onClick={() => {
                        openUrl(url).catch(() => undefined);
                    }}
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );

    return (
        <form
            className="w-full h-full min-h-0"
            onSubmit={(event) => {
                event.preventDefault();
            }}
        >
            <SettingsPageShell
                title={t('mobile.title')}
                description={t('mobile.description')}
                contentClassName="space-y-6"
            >
                {errorText && (
                    <div
                        role="alert"
                        className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                        {errorText}
                    </div>
                )}

                <SettingCard
                    title={t('mobile.cardTitle')}
                    description={t('mobile.cardDescription')}
                    icon={Smartphone}
                >
                    <SettingRow
                        title={t('mobile.enabledTitle')}
                        description={t('mobile.enabledDescription')}
                        icon={Wifi}
                    >
                        <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => {
                                setValue('enabled', checked, {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                });
                            }}
                        />
                    </SettingRow>

                    <SettingRow
                        title={t('mobile.portTitle')}
                        description={t('mobile.portDescription')}
                        icon={Wifi}
                    >
                        <div className="flex flex-col items-end gap-1">
                            <Input
                                value={portText}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-28 text-right font-mono"
                                onFocus={(event) => {
                                    portFocusedRef.current = true;
                                    setPortError(null);
                                    event.currentTarget.select();
                                }}
                                onChange={(event) => {
                                    const next = event.target.value.replace(/\D/g, '');
                                    setPortText(next);
                                }}
                                onBlur={commitPort}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.currentTarget.blur();
                                    }
                                }}
                            />
                            {portError && (
                                <span className="text-[11px] text-destructive">{portError}</span>
                            )}
                        </div>
                    </SettingRow>
                </SettingCard>

                <SettingCard title={t('mobile.addressTitle')} icon={Link2}>
                    <div className="space-y-4 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span
                                    className={cn(
                                        'h-2 w-2 rounded-full',
                                        detail.running
                                            ? 'bg-emerald-500'
                                            : detail.enabled
                                                ? 'bg-amber-500'
                                                : 'bg-muted-foreground/40',
                                    )}
                                />
                                <span>{statusText}</span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => {
                                    mutate().catch(() => undefined);
                                }}
                            >
                                {t('mobile.refresh')}
                            </Button>
                        </div>

                        {detail.running ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        {t('mobile.lanLabel')}
                                    </div>
                                    {detail.lanUrls.length > 0 ? (
                                        <div className="space-y-2">
                                            {detail.lanUrls.map(renderUrl)}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {t('mobile.lanEmpty')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {t('mobile.addressEmpty')}
                            </p>
                        )}

                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {t('mobile.remoteHint')}
                        </p>

                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {t('mobile.securityHint')}
                        </p>
                    </div>
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default MobileAccessSetting;
