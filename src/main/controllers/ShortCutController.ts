import KeyValueCache from '../ServerLib/KeyValueCache';
import TransApi from '../ServerLib/TransApi';
import CacheConfig from '../ServerLib/basecache/CacheConfig';

export async function updateShortCut(shortcut: string): Promise<void> {
    await KeyValueCache.updateValue('shortcut', shortcut);
}

export async function getShortCut(): Promise<string> {
    return (await KeyValueCache.queryValue('shortcut')) ?? '';
}
