import Header from '@/fronted/components/setting/Header';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import {Button} from "@/fronted/components/ui/button";
import Md from "@/fronted/components/chat/markdown";
import {codeBlock} from "common-tags";
import useSWR from "swr";

const api = window.electron;

const CheckUpdate = () => {

    const {data: newRelease, isLoading: checking} = useSWR('system/check-update', async () => {
        return await api.call('system/check-update', null);
    });

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <Header title="检查更新"/>
            <ItemWrapper>
                {checking && <div>检查更新中...</div>}
                {!checking && newRelease.length === 0 && (
                    <div className="text-lg">已经是最新版本</div>
                )}
                {!checking && newRelease.length > 0 && (
                    <div className="p-4 bg-muted/40 rounded border overflow-y-auto scrollbar-thin select-text">
                        <Md>
                            {newRelease.map((release) => (
                                codeBlock`
                            ## ${release.version}

                            ${release.content}
                            `
                            )).join('\n---\n')}
                        </Md>
                    </div>
                )}
            </ItemWrapper>
            <FooterWrapper>
                <Button
                    onClick={async () => {
                        await api.call('system/open-url',
                            'https://github.com/solidSpoon/DashPlayer/releases/latest'
                        );
                    }}
                >
                    前往发布页
                </Button>
            </FooterWrapper>
        </div>
    );
};

export default CheckUpdate;
