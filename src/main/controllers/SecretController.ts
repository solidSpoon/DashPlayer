import KeyValueCache from '../ServerLib/KeyValueCache';
import TransApi from '../ServerLib/TransApi';

export async function updateTencentSecret(
    secretId: string,
    secretKey: string
): Promise<void> {
    await KeyValueCache.updateValue('secretId', secretId);
    await KeyValueCache.updateValue('secretKey', secretKey);
    await TransApi.init();
}
export async function getTencentSecret(): Promise<string[]> {
    const result: string[] = [];
    const secretId = await KeyValueCache.queryValue('secretId');
    result.push(secretId || '');
    const secretKey = await KeyValueCache.queryValue('secretKey');
    result.push(secretKey || '');
    return result;
}
