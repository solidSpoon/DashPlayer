import Release from '@/common/types/release';

export interface UpdateCheckResult {
    status: 'ok' | 'error';
    releases: Release[];
    error?: string;
    shouldNotify?: boolean;
}
