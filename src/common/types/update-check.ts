import Release from '@/common/types/release';

/**
 * 更新检查失败的错误码。
 * 前端按码映射 i18n 文案，禁止直接把原始错误信息透给用户。
 */
export type UpdateCheckErrorCode = 'rate_limited' | 'network' | 'payload';

export interface UpdateCheckResult {
    status: 'ok' | 'error';
    releases: Release[];
    error?: UpdateCheckErrorCode;
    shouldNotify?: boolean;
}
