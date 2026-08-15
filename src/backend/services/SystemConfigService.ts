import { inject, injectable } from 'inversify';

import SysConfRepository from '@/backend/services/repositories/SysConfRepository';
import TYPES from '@/backend/ioc/types';

/**
 * 提供系统配置的读取和写入能力。
 */
@injectable()
export default class SystemConfigService {
    @inject(TYPES.SysConfRepository)
    private sysConfRepository!: SysConfRepository;

    /**
     * 读取指定系统配置。
     *
     * @param key 配置键。
     * @returns 配置值；配置不存在时返回 `null`。
     */
    public async getValue(key: string): Promise<string | null> {
        return this.sysConfRepository.getValue(key);
    }

    /**
     * 保存指定系统配置。
     *
     * @param key 配置键。
     * @param value 配置值。
     */
    public async setValue(key: string, value: string): Promise<void> {
        await this.sysConfRepository.setValue(key, value);
    }
}
