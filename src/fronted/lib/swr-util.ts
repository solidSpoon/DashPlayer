import {mutate} from 'swr';
import { ApiMap } from '@/common/api/api-def';

export const SWR_KEY = {
    PLAYER_P: 'PLAYER_P_SWR',
    WATCH_PROJECT_LIST: 'WATCH_PROJECT_LIST_SWR',
    WATCH_PROJECT_DETAIL: 'WATCH_PROJECT_DETAIL_SWR',
    SPLIT_VIDEO_THUMBNAIL: 'SPLIT_VIDEO_THUMBNAIL_SWR',
    WINDOW_SIZE: 'WINDOW_SIZE_SWR',
}

export const swrMutate = async (swrKey: string) => {
    // mutate start with key
    await mutate(
        key => {
            if (typeof key === 'string') {
                console.log('swrMutateStr', key);
                return key.startsWith(swrKey);
            }
            if (Array.isArray(key)) {
                console.log('swrMutateArr', key);
                return key.length > 0 && key[0] === swrKey;
            }
        },
        undefined,
        {revalidate: true}
    )
}

export const swrApiMutate = async<K extends keyof ApiMap> (path: K) => {
    await swrMutate(path);
}

export const apiPath = <K extends keyof ApiMap>(p: K) => {
    return p;
}
