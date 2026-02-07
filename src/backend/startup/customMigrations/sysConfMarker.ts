import { eq } from 'drizzle-orm';

import db from '@/backend/infrastructure/db';
import { systemConfigs } from '@/backend/infrastructure/db/tables/sysConf';
import TimeUtil from '@/common/utils/TimeUtil';

const CUSTOM_MIGRATION_MARKER_PREFIX = 'sys.migration.custom';

const buildMarkerKey = (migrationId: string): string => `${CUSTOM_MIGRATION_MARKER_PREFIX}.${migrationId}`;

export const isCustomMigrationCompleted = async (migrationId: string): Promise<boolean> => {
    const markerKey = buildMarkerKey(migrationId);
    const result = await db
        .select({ value: systemConfigs.value })
        .from(systemConfigs)
        .where(eq(systemConfigs.key, markerKey))
        .limit(1);

    const markerValue = result[0]?.value;
    return typeof markerValue === 'string' && markerValue.trim().length > 0;
};

export const markCustomMigrationCompleted = async (migrationId: string): Promise<void> => {
    const markerKey = buildMarkerKey(migrationId);
    const markerValue = `done@${new Date().toISOString()}`;

    await db
        .insert(systemConfigs)
        .values({
            key: markerKey,
            value: markerValue,
        })
        .onConflictDoUpdate({
            target: systemConfigs.key,
            set: {
                value: markerValue,
                updated_at: TimeUtil.timeUtc(),
            },
        });
};
