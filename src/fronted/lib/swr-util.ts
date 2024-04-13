import { mutate } from 'swr';

export const SWR_KEY = {
    PLAYER_P: 'PLAYER_P_SWR',
    WATCH_PROJECT_LIST: 'WATCH_PROJECT_LIST_SWR',
    WATCH_PROJECT_DETAIL: 'WATCH_PROJECT_DETAIL_SWR',
}

export const swrMutate = async (swrKey: string) => {
    // mutate start with key
   await mutate(
        key => typeof key === 'string' && key.startsWith(swrKey),
        undefined,
        { revalidate: true }
    )
}
