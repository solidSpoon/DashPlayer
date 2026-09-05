import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart } from 'recharts';
import { ChartPie, RefreshCw } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/fronted/components/ui/chart';
import { cn } from '@/fronted/lib/utils';
import { SettingCard } from '@/fronted/features/settings/components/form';
import {
    StorageUsageCategory,
    StorageUsageVO,
} from '@/common/contracts/storage-usage-vo';

/**
 * 各用量分类在图表中的固定配色；同时用于图例色块。
 */
const USAGE_CHART_COLORS: Record<StorageUsageCategory, string> = {
    videos: '#3b82f6',
    favorite_clips: '#f97316',
    word_clips: '#10b981',
    models: '#8b5cf6',
    temp: '#64748b',
    other: '#ec4899',
};

/**
 * 将字节数格式化为带单位的可读大小。
 * @param bytes 文件大小，单位字节。
 * @returns 带单位的文件大小；不足 1 KB 时保留整数。
 */
function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return unitIndex === 0
        ? `${size} ${units[unitIndex]}`
        : `${size.toFixed(2)} ${units[unitIndex]}`;
}

export interface StorageUsageCardProps {
    /** 用量明细；`null` 表示尚未加载完成或存储目录不可用。 */
    usage: StorageUsageVO | null;
    /** 是否正在加载用量明细。 */
    loading: boolean;
    /** 手动触发一次用量刷新。 */
    onRefresh: () => void;
}

/**
 * 存储用量卡片：以环形图加明细列表展示媒体库各分类的占用大小。
 */
const StorageUsageCard = ({ usage, loading, onRefresh }: StorageUsageCardProps) => {
    const { t } = useTranslation('settings');

    const chartConfig = React.useMemo<ChartConfig>(() => {
        const config: ChartConfig = {};
        for (const category of Object.keys(USAGE_CHART_COLORS) as StorageUsageCategory[]) {
            config[category] = {
                label: t(`storage.usage.categories.${category}`),
                color: USAGE_CHART_COLORS[category],
            };
        }
        return config;
    }, [t]);

    const chartData = React.useMemo(
        () => (usage?.items ?? []).map((item) => ({
            category: item.category,
            bytes: item.bytes,
            fill: `var(--color-${item.category})`,
        })),
        [usage],
    );

    const totalBytes = usage?.totalBytes ?? 0;

    /**
     * 状态文案：加载中、目录不可用或媒体库为空时替代图表展示。
     */
    const statusMessage = loading
        ? t('storage.usage.loading')
        : usage === null
            ? t('storage.usage.unavailable')
            : totalBytes === 0
                ? t('storage.usage.empty')
                : null;

    return (
        <SettingCard
            title={t('storage.usage.title')}
            icon={ChartPie}
            headerAction={(
                <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <span>{t('storage.usage.totalLabel')}</span>
                        <span className="font-mono font-semibold text-foreground px-2 py-0.5 rounded bg-muted/80">
                            {usage ? formatBytes(totalBytes) : '--'}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    </Button>
                </div>
            )}
        >
            {statusMessage ? (
                <div className="flex h-44 items-center justify-center p-4 text-sm text-muted-foreground">
                    {statusMessage}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-6 p-4 sm:flex-row sm:gap-8">
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square h-44 w-44 shrink-0"
                    >
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={(
                                    <ChartTooltipContent
                                        hideLabel
                                        formatter={(value, name) => (
                                            <div className="flex min-w-32 items-center justify-between gap-4 leading-none">
                                                <span className="text-muted-foreground">
                                                    {chartConfig[name as string]?.label ?? name}
                                                </span>
                                                <span className="font-mono font-medium tabular-nums text-foreground">
                                                    {formatBytes(Number(value))}
                                                    {totalBytes > 0 && (
                                                        <span className="ml-2 text-muted-foreground">
                                                            {((Number(value) / totalBytes) * 100).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    />
                                )}
                            />
                            <Pie
                                data={chartData}
                                dataKey="bytes"
                                nameKey="category"
                                innerRadius={50}
                                outerRadius={78}
                                paddingAngle={2}
                                strokeWidth={2}
                            >
                                {chartData.map((entry) => (
                                    <Cell key={entry.category} fill={entry.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="w-full min-w-0 flex-1 space-y-2">
                        {(usage?.items ?? []).map((item) => (
                            <div
                                key={item.category}
                                className="flex items-center gap-2 text-xs"
                            >
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: USAGE_CHART_COLORS[item.category] }}
                                />
                                <span className="text-muted-foreground truncate">
                                    {t(`storage.usage.categories.${item.category}`)}
                                </span>
                                <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                    {formatBytes(item.bytes)}
                                </span>
                                <span className="w-14 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                                    {((item.bytes / totalBytes) * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </SettingCard>
    );
};

export default StorageUsageCard;
