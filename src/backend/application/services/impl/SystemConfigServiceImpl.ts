import { inject, injectable } from 'inversify';

import SystemConfigService from '@/backend/application/services/SystemConfigService';
import TYPES from '@/backend/ioc/types';
import SysConfRepository from '@/backend/infrastructure/db/repositories/SysConfRepository';

@injectable()
export default class SystemConfigServiceImpl implements SystemConfigService {

    @inject(TYPES.SysConfRepository)
    private sysConfRepository!: SysConfRepository;

    public async getValue(key: string): Promise<string | null> {
        return this.sysConfRepository.getValue(key);
    }

    public async setValue(key: string, value: string): Promise<void> {
        await this.sysConfRepository.setValue(key, value);
    }
}
