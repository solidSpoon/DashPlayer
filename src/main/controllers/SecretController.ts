import KeyValueCache from '../ServerLib/KeyValueCache';
import TransApi from '../ServerLib/TransApi';
import CacheConfig from '../ServerLib/basecache/CacheConfig';

function trim(str: string): string {
    if (str === null || str === undefined) {
        return '';
    }
    return str.trim();
}
export async function updateTencentSecret(
    secretId: string,
    secretKey: string
): Promise<void> {
    await KeyValueCache.updateValue('tenantSecretId', trim(secretId));
    await KeyValueCache.updateValue('tenantSecretKey', trim(secretKey));
    await TransApi.init();
}
export async function getTencentSecret(): Promise<string[]> {
    const result: string[] = [];
    const secretId = await KeyValueCache.queryValue('tenantSecretId');
    result.push(secretId || '');
    const secretKey = await KeyValueCache.queryValue('tenantSecretKey');
    result.push(secretKey || '');
    return result;
}
export async function updateYouDaoSecret(
    secretId: string,
    secretKey: string
): Promise<void> {
    console.log(CacheConfig.wordConfig.filename);
    await KeyValueCache.updateValue('youDaoSecretId', trim(secretId));
    await KeyValueCache.updateValue('youDaoSecretKey', trim(secretKey));
}

export async function getYouDaoSecret(): Promise<string[]> {
    const result: string[] = [];
    const secretId = await KeyValueCache.queryValue('youDaoSecretId');
    result.push(secretId || '');
    const secretKey = await KeyValueCache.queryValue('youDaoSecretKey');
    result.push(secretKey || '');
    return result;
}
