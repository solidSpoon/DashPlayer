import { Octokit } from '@octokit/core';

const octokit = new Octokit({});

export interface Release {
    url: string;
    version: string;
    description: string;
}

const a = async (): Promise<Release | null> => {
    const res = await octokit.request(
        'GET /repos/{owner}/{repo}/releases/latest',
        {
            owner: 'solidSpoon',
            repo: 'DashPlayer',
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        }
    );
    if (res.status !== 200) {
        return null;
    }
    const { data } = res;
    return {
        url: data.html_url,
        version: data.tag_name,
        description: data.body ?? '',
    };
};
a();
