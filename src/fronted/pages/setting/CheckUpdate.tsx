import {useEffect, useState} from 'react';
import Release from '@/common/types/release';
import Header from '@/fronted/components/setting/Header';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import {Button} from "@/fronted/components/ui/button";
import Md from "@/fronted/components/chat/markdown";
import {codeBlock} from "common-tags";

const api = window.electron;

const CheckUpdate = () => {
    const [newRelease, setNewRelease] = useState<Release[]>([]);

    const [checking, setChecking] = useState<boolean>(true);

    useEffect(() => {
        const fun = async () => {
            const nr = await api.checkUpdate();
            setNewRelease(nr);
            setChecking(false);
        };
        fun();
    }, []);

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
                    onClick={() => {
                        api.openUrl(
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
