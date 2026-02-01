import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import MediaUtil, {
    AllFormats,
    SupportedFormats,
} from '@/common/utils/MediaUtil';
import useFile from '@/fronted/hooks/useFile';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import useLayout from '@/fronted/hooks/useLayout';
import useConvert from '@/fronted/hooks/useConvert';
import { toast } from 'sonner';
import StrUtil from '@/common/utils/str-util';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { i18n } from '@/fronted/i18n/i18n';

const api = backendClient;

export class FileAction {

    public static playerAction(navigate: (s: string) => void) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSubtitle(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (StrUtil.isNotBlank(videoPath)) {
                    await api.call('watch-history/attach-srt', { videoPath, srtPath: ps[0] });
                    useFile.getState().clearSrt();
                }
            } else {
                const [id] = await api.call('watch-history/create', ps);
                await api.call('system/window-size/change', 'player');
                navigate(`/player/${id}`);
                const mkvs = ps.filter(p => p.toLowerCase().endsWith('.mkv'));
                if (mkvs.length > 0) {
                    const suggested = await Promise.all(mkvs.map((p) => api.call('convert/suggest-html5-video', p)));
                    const missing = mkvs.filter((_p, idx) => !suggested[idx]);
                    if (missing.length === 0) {
                        return;
                    }
                    const suspiciousAudioCodecs = new Set([
                        // DTS may appear as `dts` or `dca` in ffprobe
                        'dts',
                        'dca',
                        // TrueHD may appear as `truehd` or `mlp`
                        'truehd',
                        'mlp',
                        'eac3',
                        'ac3',
                        'opus',
                        'vorbis',
                    ]);
                    const infos = await Promise.all(missing.map((p) => api.call('convert/video-info', p)));
                    const suspiciousFiles = missing.filter((_p, idx) => {
                        const audioCodec = (infos[idx]?.audioCodec ?? '').toLowerCase();
                        return audioCodec.length === 0 || suspiciousAudioCodecs.has(audioCodec);
                    });
                    if (suspiciousFiles.length === 0) {
                        return;
                    }
                    setTimeout(() => {
                        toast(i18n.t('toast.silentVideoTitle'), {
                            description: i18n.t('toast.silentVideoDescription'),
                            position: 'top-right',
                            action: {
                                label: i18n.t('toast.silentVideoAction'),
                                onClick: () => {
                                    useConvert.getState().addFiles(suspiciousFiles);
                                    navigate(`/convert`);
                                }
                            }
                        });
                    }, 500);
                }
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrApiMutate('watch-history/list');
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };

    }

    public static playerAction2(navigate: (s: string) => void) {
        return async (ps: string[]) => {
            if (ps.length === 1 && MediaUtil.isSubtitle(ps[0])) {
                const videoPath = useFile.getState().videoPath;
                if (StrUtil.isNotBlank(videoPath)) {
                    await api.call('watch-history/attach-srt', { videoPath, srtPath: ps[0] });
                    useFile.getState().clearSrt();
                }
            } else {
                const [id] = await api.call('watch-history/create', ps);
                await api.call('system/window-size/change', 'player');
                useLayout.getState().changeSideBar(false);
                navigate(`/player/${id}`);

                const mkvs = ps.filter(p => p.toLowerCase().endsWith('.mkv'));
                if (mkvs.length > 0) {
                    const suggested = await Promise.all(mkvs.map((p) => api.call('convert/suggest-html5-video', p)));
                    const missing = mkvs.filter((_p, idx) => !suggested[idx]);
                    if (missing.length === 0) {
                        return;
                    }
                    const suspiciousAudioCodecs = new Set([
                        'dts',
                        'dca',
                        'truehd',
                        'mlp',
                        'eac3',
                        'ac3',
                        'opus',
                        'vorbis',
                    ]);
                    const infos = await Promise.all(missing.map((p) => api.call('convert/video-info', p)));
                    const suspiciousFiles = missing.filter((_p, idx) => {
                        const audioCodec = (infos[idx]?.audioCodec ?? '').toLowerCase();
                        return audioCodec.length === 0 || suspiciousAudioCodecs.has(audioCodec);
                    });
                    if (suspiciousFiles.length === 0) {
                        return;
                    }
                    setTimeout(() => {
                        toast('某些视频可能在播放器里无声', {
                            description: '如果遇到无声/无法播放，建议生成“兼容播放版本”',
                            position: 'top-right',
                            action: {
                                label: '去生成',
                                onClick: () => {
                                    useConvert.getState().addFiles(suspiciousFiles);
                                    navigate(`/convert`);
                                }
                            }
                        });
                    }, 500);
                }
            }
            await swrMutate(SWR_KEY.PLAYER_P);
            await swrApiMutate('watch-history/list');
            await swrMutate(SWR_KEY.WATCH_PROJECT_DETAIL);
        };

    }
}

export default function FileSelector({
                                         onSelected,
                                         withMkv
                                     }: {
    onSelected: (ps: string[]) => Promise<void>;
    withMkv?: boolean;
}) {
    const handleClick = async () => {
        const ps = await api.call('system/select-file', withMkv ? AllFormats : SupportedFormats);
        if (ps?.length > 0) {
            await onSelected(ps);
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={() => handleClick()}
                        variant={'outline'}
                        className={cn('w-28')}
                    >Open File</Button>
                </TooltipTrigger>
                <TooltipContent>
                    可以同时选择一个视频文件及其对应的字幕文件
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
FileSelector.defaultProps = {
    withMkv: false
};
