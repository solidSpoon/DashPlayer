import TransHolder from '@/common/utils/TransHolder';

export interface TencentTranslateClient {
    batchTrans(source: string[]): Promise<TransHolder<string>>;
}

