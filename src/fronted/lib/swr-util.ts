import {mutate} from 'swr';

export const SWR_KEY = {
    PLAYER_P: 'PLAYER_P_SWR',
    WATCH_PROJECT_LIST: 'WATCH_PROJECT_LIST_SWR',
    WATCH_PROJECT_DETAIL: 'WATCH_PROJECT_DETAIL_SWR',
}

export const swrMutate = async (swrKey: string) => {
    // mutate start with key
    await mutate(
        key => {
            if (typeof key === 'string') {
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
