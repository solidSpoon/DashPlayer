import { useEffect } from 'react';

import useFile from '@/fronted/features/file-browser/fileStore';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useDubbing } from '../dubbingStore';
import { useDubbingRecorder } from '../useDubbingRecorder';

const logger = getRendererLogger('DubbingController');

/**
 * 配音无 UI 控制器：挂载快捷键监听并按视频加载配音清单。
 *
 * 状态展示集中在主字幕区胶囊控制栏（DubbingRecordButton / DubbingTakeChip），
 * 此组件只负责副作用，随播放舞台常驻挂载（含全屏）。
 */
export default function DubbingController() {
    useDubbingRecorder();
    const srtHash = useFile((s) => s.srtHash);

    // 视频切换时重置录音流程并加载新视频的配音清单
    useEffect(() => {
        useDubbing.getState().reset();
        if (!srtHash) {
            return;
        }
        useDubbing.getState().loadManifest(srtHash).catch((error) => {
            logger.error('加载配音清单失败', { error });
        });
    }, [srtHash]);

    return null;
}
