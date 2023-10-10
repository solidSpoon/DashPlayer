import axios from 'axios';
import { app } from 'electron';

export interface Release {
    url: string;
    version: string;
}

export const checkUpdate = async (): Promise<Release | null> => {
    const currentVersion = app.getVersion();

    const result = await axios.get(
        'https://api.github.com/repos/solidSpoon/DashPlayer/releases/latest'
    );

    if (result.status !== 200) {
        return null;
    }

    if (result.data.tag_name === `v${currentVersion}`) {
        return null;
    }

    return {
        url: result.data.html_url,
        version: result.data.tag_name,
    };
};

export const appVersion = (): string => {
    return app.getVersion();
};
