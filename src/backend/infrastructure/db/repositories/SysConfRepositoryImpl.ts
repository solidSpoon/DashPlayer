import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';

import type { Db } from '@/backend/infrastructure/db/createDb';
import { systemConfigs } from '@/backend/infrastructure/db/tables/sysConf';
import SysConfRepository from '@/backend/services/repositories/SysConfRepository';
import TYPES from '@/backend/ioc/types';
import TimeUtil from '@/common/utils/TimeUtil';

@injectable()
export default class SysConfRepositoryImpl implements SysConfRepository {
    /**
     * @param db 由依赖容器注入的 drizzle 实例；测试中可替换为内存库。
     */
    constructor(@inject(TYPES.Database) private readonly db: Db) {}

    public async getValue(key: string): Promise<string | null> {
        const result = await this.db
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
        await this.db
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

