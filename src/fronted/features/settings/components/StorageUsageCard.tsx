import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart } from 'recharts';
import { ChartPie, RefreshCw, HardDriveDownload } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/fronted/components/ui/chart';
import { Skeleton } from '@/fronted/components/ui/skeleton';
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

const CATEGORY_ORDER: StorageUsageCategory[] = [
    'videos',
    'word_clips',
    'models',
    'temp',
    'favorite_clips',
    'other',
];

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
 * 存储用量卡片的加载骨架屏。
 * 保持与加载后完全一致的尺寸和布局（环形图 + 6行明细），避免布局跳变。
 */
const StorageUsageSkeleton = () => {
    return (
        <div
            data-testid="storage-usage-skeleton"
            className="flex flex-col items-center gap-6 p-4 sm:flex-row sm:gap-8"
        >
            {/* 环形图骨架 */}
            <div className="mx-auto flex aspect-square h-44 w-44 shrink-0 items-center justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center">
                    <Skeleton className="h-40 w-40 rounded-full" />
                    <div className="absolute h-24 w-24 rounded-full bg-card" />
                </div>
            </div>

            {/* 明细列表骨架：高度与真实条目完全 1:1 对齐 */}
            <div className="w-full min-w-0 flex-1 space-y-2">
                {CATEGORY_ORDER.map((key) => (
                    <div
                        key={key}
                        className="flex items-center gap-3 rounded-md px-2 py-1 text-xs"
                    >
                        <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-[2px]" />
                        <Skeleton className="h-4 w-24 shrink-0" />
                        <div className="relative mx-1 hidden h-1.5 flex-1 overflow-hidden rounded-full sm:block">
                            <Skeleton className="h-full w-full rounded-full" />
                        </div>
                        <Skeleton className="ml-auto h-4 w-16" />
                        <Skeleton className="h-4 w-12 shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
};

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
     * 当处于加载态且尚未获取到用量数据时展示骨架屏。
     */
    const showSkeleton = loading && !usage;

    /**
     * 异常或空数据提示。
     */
    const emptyOrUnavailableMessage = !loading && usage === null
        ? t('storage.usage.unavailable')
        : !loading && totalBytes === 0
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
                        {showSkeleton ? (
                            <Skeleton className="h-5 w-16 rounded" />
                        ) : (
                            <span className="font-mono font-semibold text-foreground px-2 py-0.5 rounded bg-muted/80 tabular-nums">
                                {usage ? formatBytes(totalBytes) : '--'}
                            </span>
                        )}
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
            {showSkeleton ? (
                <StorageUsageSkeleton />
            ) : emptyOrUnavailableMessage ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                    <HardDriveDownload className="h-8 w-8 stroke-1 text-muted-foreground/50" />
                    <p>{emptyOrUnavailableMessage}</p>
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
                        {(usage?.items ?? []).map((item) => {
                            const ratio = totalBytes > 0 ? item.bytes / totalBytes : 0;
                            const percentage = (ratio * 100).toFixed(1);
                            const isZero = item.bytes === 0;

                            return (
                                <div
                                    key={item.category}
                                    className={cn(
                                        'group relative flex items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted/40 text-xs',
                                        isZero && 'opacity-60 hover:opacity-100'
                                    )}
                                >
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-[2px] shadow-xs"
                                        style={{ backgroundColor: USAGE_CHART_COLORS[item.category] }}
                                    />
                                    <span className="text-muted-foreground truncate w-24 shrink-0 font-medium">
                                        {t(`storage.usage.categories.${item.category}`)}
                                    </span>

                                    {/* 细长进度条槽位 */}
                                    <div className="relative mx-1 hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60 sm:block">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.max(ratio * 100, item.bytes > 0 ? 1 : 0)}%`,
                                                backgroundColor: USAGE_CHART_COLORS[item.category],
                                            }}
                                        />
                                    </div>

                                    <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                        {formatBytes(item.bytes)}
                                    </span>
                                    <span className="w-12 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                                        {percentage}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </SettingCard>
    );
};

export default StorageUsageCard;
