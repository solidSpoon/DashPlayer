export type COOKIE = 'chrome' | 'firefox' | 'safari' | 'edge' | 'no-cookie';
export const cookieType =(str: COOKIE): string =>  {
    return str;
}

export interface DlVideoContext {
    taskId: number;
    url: string;
    cookies: COOKIE;
    savePath: string;
}
