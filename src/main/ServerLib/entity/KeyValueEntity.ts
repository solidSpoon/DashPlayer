import BaseCacheEntity from '../basecache/BaseCacheEntity';

export default class KeyValueEntity extends BaseCacheEntity<KeyValueEntity> {
    readonly key: string;

    value: string | undefined;

    constructor(key: string) {
        super(key);
        this.key = key;
    }
}
