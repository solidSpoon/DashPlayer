import KeyValueEntity from '../ServerLib/entity/KeyValueEntity';
import KeyValueCache from '../ServerLib/KeyValueCache';

export async function updateTencentSecretKey(secretKey: string) {
    const secretKeyEntity = new KeyValueEntity('secretKey');
    secretKeyEntity.value = secretKey;
    await KeyValueCache.updateValue(secretKeyEntity);
}

export async function updateTencentSecretId(secretId: string) {
    const secretKeyEntity = new KeyValueEntity('secretId');
    secretKeyEntity.value = secretId;
    await KeyValueCache.updateValue(secretKeyEntity);
}
