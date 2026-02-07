import path from 'path';
import { app } from 'electron';

export const isDevelopmentMode = (): boolean => {
    if (process.env.NODE_ENV === 'development') {
        return true;
    }

    return !app.isPackaged;
};

export const getEnvironmentSuffix = (): string => {
    return isDevelopmentMode() ? '-dev' : '';
};

export const getEnvironmentConfigName = (baseName: string): string => {
    return `${baseName}${isDevelopmentMode() ? '.dev' : ''}`;
};

export const getRuntimeResourcePath = (...segments: string[]): string => {
    if (isDevelopmentMode()) {
        return path.resolve(...segments);
    }

    return path.join(process.resourcesPath, ...segments);
};
