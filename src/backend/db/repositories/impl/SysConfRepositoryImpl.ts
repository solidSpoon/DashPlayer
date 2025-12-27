import { eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/db';
import { systemConfigs } from '@/backend/db/tables/sysConf';
import SysConfRepository from '@/backend/db/repositories/SysConfRepository';
import TimeUtil from '@/common/utils/TimeUtil';

@injectable()
export default class SysConfRepositoryImpl implements SysConfRepository {
    public async getValue(key: string): Promise<string | null> {
        const result = await db
            .select()
            .from(systemConfigs)
            .where(eq(systemConfigs.key, key))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        const value = result[0].value;
        return typeof value === 'string' ? value : null;
    }

    public async setValue(key: string, value: string): Promise<void> {
        await db
            .insert(systemConfigs)
            .values({ key, value })
            .onConflictDoUpdate({
                target: systemConfigs.key,
                set: {
                    value,
                    updated_at: TimeUtil.timeUtc(),
                },
            });
    }
}

