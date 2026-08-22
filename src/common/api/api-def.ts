import {DpTask} from '@/common/contracts/dp-task';
import {YdRes, OpenAIDictionaryResult} from '@/common/types/YdRes';
import {ChapterParseResult} from '@/common/types/chapter-result';
import {SrtSentence} from '@/common/types/SentenceC';
import {WindowState} from '@/common/types/Types';
import {SubtitleTimestampAdjustmentInput} from '@/common/contracts/subtitle-timestamp-adjustment';
import { UpdateCheckResult } from '@/common/types/update-check';
import { FolderVideos } from '@/common/contracts/convert';

import {Tag} from '@/common/contracts/tag';
import {ClipQuery, SimpleClipQuery} from '@/common/api/dto';
import {ClipMeta, OssBaseMeta} from '@/common/types/clipMeta';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import {VideoLearningClipPage} from '@/common/types/vo/VideoLearningClipVO';
import { GlobalVideoLearningClipQueueStatusVO, VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import {
    ChatSessionCloseParams,
    ChatSessionCreateParams,
    ChatSessionCreateResult,
    ChatSessionStopParams,
    ChatStartParams,
    ChatStartResult,
    ChatWelcomeParams,
} from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';
import {
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';
import { ProxySettingDetailVO, ProxySettingSaveVO } from '@/common/contracts/proxy-setting-vo';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';
import {
    RuntimeSettingSaveRequest,
    RuntimeSettingsSnapshot,
} from '@/common/contracts/runtime-settings';
import { ParakeetModelStatusVO } from '@/common/types/vo/parakeet-model-vo';
import { SherpaTtsModelStatusVO } from '@/common/types/vo/sherpa-tts-model-vo';
import { VideoInfo } from '@/common/types/video-info';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import { TranscriptTask } from '@/common/contracts/transcript/transcript-task';

interface ApiDefinition {
    'eg': { params: string, return: number },
}

// 定义额外的接口
interface AiFuncDef {
    'ai-func/tts': { params: string, return: string };
    'ai-func/format-split': { params: string, return: number };
}

interface TranscriptDef {
    'transcript/list': { params: void, return: TranscriptTask[] };
    'transcript/enqueue': { params: { filePath: string }, return: TranscriptTask };
    'transcript/remove': { params: { filePath: string }, return: void };
    'transcript/start': { params: { filePath: string }, return: 'started' | 'model_missing' };
    'transcript/cancel': { params: { filePath: string }, return: boolean };
}

interface SherpaTtsModelDef {
    'sherpa-tts/models/status': { params: void, return: SherpaTtsModelStatusVO };
    'sherpa-tts/models/download': { params: void, return: { success: boolean; message: string } };
    'sherpa-tts/models/cancel-download': { params: void, return: { cancelled: boolean } };
    'sherpa-tts/models/delete': { params: void, return: { success: boolean; message: string } };
}

interface DpTaskDef {
    'dp-task/detail': { params: number, return: DpTask | null };
    'dp-task/cancel': { params: number, return: void };
    'dp-task/details': { params: number[], return: Map<number, DpTask> };
}

interface SystemDef {
    'system/info': {
        params: void, return: {
            isWindows: boolean,
            isMac: boolean,
            isLinux: boolean,
            pathSeparator: string,
        }
    };
    'system/select-file': {
        params: string[],
        return: string[]
    };
    'system/select-folder': {
        params: { defaultPath?: string, createDirectory?: boolean },
        return: string[]
    };
    'system/path-info': {
        params: string, return: {
            /**
             * e.g. 'index.html'
             */
            baseName: string,
            /**
             * e.g. '/home/user/dir'
             */
            dirName: string,
            /**
             * e.g. '.html'
             */
            extName: string
        }
    };
    'system/reset-db': { params: void, return: void };
    'system/open-folder': { params: string, return: void };
    'system/open-folder/cache': { params: void, return: void };
    'system/window-size/change': { params: WindowState, return: void };
    'system/window-size': { params: void, return: WindowState };
    'system/window-buttons/visibility': { params: boolean, return: void };
    'system/check-update': { params: { mode?: 'toast' }, return: UpdateCheckResult };
    'system/open-url': { params: string, return: void };
    'system/app-version': { params: void, return: string };
    'system/test-renderer-api': { params: void, return: void };
}

interface AiTransDef {
    'ai-trans/word': {
        params: { word: string; forceRefresh?: boolean; requestId?: string },
        return: YdRes | OpenAIDictionaryResult | null
    };
    /** 更新当前字幕播放位置，后端异步处理当前批次与预取批次。 */
    'ai-trans/update-subtitle-demand': {
        params: {
            fileHash: string,
            currentIndex: number,
            demandId: number,
            rendererSessionId: string,
        },
        return: void
    };
    /** 释放字幕文件对应的后端翻译会话。 */
    'ai-trans/release-subtitle-session': {
        params: {
            fileHash: string,
            rendererSessionId: string,
        },
        return: void
    };
    // 测试腾讯翻译API
    'ai-trans/test-tencent': { params: void, return: void };
    // 测试新的翻译流程
    'ai-trans/test-new-flow': { params: void, return: void };
}

interface ChatDef {
    'chat/session/create': { params: ChatSessionCreateParams, return: ChatSessionCreateResult };
    'chat/session/close': { params: ChatSessionCloseParams, return: void };
    'chat/session/stop': { params: ChatSessionStopParams, return: void };
    'chat/start': { params: ChatStartParams, return: ChatStartResult };
    'chat/welcome': { params: ChatWelcomeParams, return: ChatStartResult };
}

interface ChatAnalysisDef {
    'chat/analysis/start': { params: AnalysisStartParams, return: AnalysisStartResult };
}

interface WatchHistoryDef {
    'watch-history/list': { params: string, return: WatchHistoryVO[] };
    'watch-history/list/basic': { params: string, return: WatchHistoryVO[] };
    'watch-history/progress/update': {
        params: { file: string, currentPosition: number },
        return: void
    };
    'watch-history/create': { params: string[], return: string[] };
    'watch-history/create/from-library': { params: string[], return: string[] };
    'watch-history/group-delete': { params: string, return: void };
    'watch-history/detail': { params: string, return: WatchHistoryVO | null };
    'watch-history/player-detail': { params: string, return: WatchHistoryVO | null };
    'watch-history/player-subtitle': { params: string, return: string };
    'watch-history/attach-srt': { params: { videoPath: string, srtPath: string | 'same' }, return: void };
    'watch-history/suggest-srt': { params: string, return: string[] };
    'watch-history/get-next-video': { params: string, return: WatchHistoryVO | null };
    'watch-history/set-podcast-mode-preference': {
        params: { videoId: string, podcastMode: boolean },
        return: void
    };
}

interface SubtitleControllerDef {
    'subtitle/srt/parse-to-sentences': {
        params: {
            subtitlePath: string | null;
            videoId: string;
            playbackSessionId: string;
        };
        return: SrtSentence | null;
    };
    'subtitle/srt/match-vocabulary': {
        params: {
            fileHash: string;
            videoId: string;
            playbackSessionId: string;
        };
        return: {
            videoId: string;
            playbackSessionId: string;
            fileHash: string;
            vocabularyWords: string[];
            cancelled: boolean;
        };
    };
}

interface SubtitleTimestampAdjustmentControllerDef {
    'subtitle-timestamp/delete/by-file-hash': { params: string, return: void };
    'subtitle-timestamp/delete/by-key': { params: string, return: void };
    'subtitle-timestamp/update': { params: SubtitleTimestampAdjustmentInput, return: void };
}

interface StorageDef {
    'storage/cache/size': { params: void, return: string };
    'storage/status': { params: void, return: StorageStatusVO };
    'storage/collection/paths': { params: void, return: string[] };
}

interface SettingsDef {
    'settings/runtime/detail': { params: void, return: RuntimeSettingsSnapshot };
    'settings/runtime/save': { params: RuntimeSettingSaveRequest, return: void };
    'settings/service-credentials/detail': { params: void, return: ServiceCredentialSettingDetailVO };
    'settings/service-credentials/save': { params: ServiceCredentialSettingSaveVO, return: void };
    'settings/service-credentials/test-openai': { params: void, return: { success: boolean, message: string } };
    'settings/service-credentials/test-tencent': { params: void, return: { success: boolean, message: string } };
    'settings/service-credentials/test-youdao': { params: void, return: { success: boolean, message: string } };
    'settings/engine-selection/detail': { params: void, return: EngineSelectionSettingVO };
    'settings/engine-selection/save': { params: EngineSelectionSettingVO, return: void };
    'settings/shortcuts/detail': { params: void, return: ShortcutSettingDetailVO };
    'settings/shortcuts/save': { params: ShortcutSettingSaveVO, return: void };
    'settings/appearance/detail': { params: void, return: AppearanceSettingVO };
    'settings/appearance/save': { params: AppearanceSettingVO, return: void };
    'settings/storage/detail': { params: void, return: StorageSettingVO };
    'settings/storage/save': { params: StorageSettingVO, return: void };
    'settings/proxy/detail': { params: void, return: ProxySettingDetailVO };
    'settings/proxy/save': { params: ProxySettingSaveVO, return: void };
}

interface ParakeetModelDef {
    'parakeet/models/status': { params: void, return: ParakeetModelStatusVO };
    'parakeet/models/download': { params: void, return: { success: boolean; message: string } };
    'parakeet/models/cancel-download': { params: void, return: { cancelled: boolean } };
    'parakeet/models/delete': { params: void, return: { success: boolean; message: string } };
}

/** 视频切分 IPC 定义。 */
interface SplitVideoDef {
    'split-video/preview': { params: string, return: ChapterParseResult[] };
    'split-video/split': {
        params: { videoPath: string, srtPath: string | null, chapters: ChapterParseResult[] },
        return: string
    };
}

/** 通用媒体信息和缩略图 IPC 定义。 */
interface MediaDef {
    'media/thumbnail': {
        params: {
            filePath: string,
            time: number,
            quality?: 'low' | 'medium' | 'high' | 'ultra',
            width?: number,
            format?: 'jpg' | 'png'
        },
        return: string
    };
    'media/duration': { params: string, return: number };
    'media/info': { params: string, return: VideoInfo };
}

interface ConvertDef {
    'convert/to-mp4': { params: string, return: number };
    'convert/from-folder': { params: string[], return: FolderVideos[] };
    'convert/suggest-html5-video': { params: string, return: string | null };

}

interface FavoriteClipsDef {
    'favorite-clips/add': { params: { videoPath: string, srtKey: string, indexInSrt: number }, return: void };
    'favorite-clips/search': { params: ClipQuery, return: (ClipMeta & OssBaseMeta)[] };
    'favorite-clips/query-clip-tags': { params: string, return: Tag[] };
    'favorite-clips/add-clip-tag': { params: { key: string, tagId: number }, return: void };
    'favorite-clips/delete-clip-tag': { params: { key: string, tagId: number }, return: void };
    'favorite-clips/cancel-add': { params: { srtKey: string, indexInSrt: number }, return: void };
    'favorite-clips/exists': { params: { srtKey: string, linesInSrt: number[] }, return: Map<number, boolean> };
    'favorite-clips/task-info': { params: void, return: number };
    'favorite-clips/delete': { params: string, return: void };
    'favorite-clips/translate': { params: string[], return: Map<string, string> };
    'favorite-clips/sync-from-oss': { params: void, return: void };
    // 'favorite-clips/get': { params: string, return: { metadata: MetaData, clipPath: string } };
}

interface TagDef {
    'tag/add': { params: string, return: Tag };
    'tag/delete': { params: number, return: void };
    'tag/update': { params: { id: number, name: string }, return: void };
    'tag/search': { params: string, return: Tag[] };
}

interface VocabularyDef {
    'vocabulary/get-all': {
        params: { search?: string; page?: number; pageSize?: number },
        return: { success: boolean; data?: unknown[]; error?: string }
    };
    'vocabulary/export-template': {
        params: void,
        return: { success: boolean; data?: string; error?: string }
    };
    'vocabulary/import': {
        params: { filePath: string },
        return: { success: boolean; message?: string; error?: string }
    };
}

interface VideoLearningDef {
    'video-learning/detect-clip-status': {
        params: { videoPath: string; srtKey: string; srtPath?: string },
        return: VideoLearningClipStatusVO
    };
    'video-learning/clip-queue-status': {
        params: void,
        return: GlobalVideoLearningClipQueueStatusVO
    };
    'video-learning/auto-clip': {
        params: { videoPath: string; srtKey: string; srtPath?: string },
        return: { success: boolean }
    };
    'video-learning/cancel-auto-clip-all': {
        params: void,
        return: { success: boolean; clearedCount: number }
    };
    'video-learning/delete': {
        params: { key: string },
        return: { success: boolean }
    };
    'video-learning/search': {
        params: SimpleClipQuery,
        return: { success: boolean; data: VideoLearningClipPage }
    };
    'video-learning/resolve-clip-vocabulary': {
        params: { lines: ClipMeta['clip_content']; words: string[] },
        return: { success: boolean; data: VideoLearningClipPage['items'][number]['vocabulary'] }
    };
    'video-learning/sync-from-oss': {
        params: void,
        return: { success: boolean }
    };
    'video-learning/clip-counts': {
        params: void,
        return: { success: boolean; data: Record<string, number> }
    };
}


// 使用交叉类型合并 ApiDefinitions 和 ExtraApiDefinition
export type ApiDefinitions = ApiDefinition
    & AiFuncDef
    & TranscriptDef
    & DpTaskDef
    & SystemDef
    & AiTransDef
    & ChatDef
    & ChatAnalysisDef
    & WatchHistoryDef
    & SubtitleControllerDef
    & SherpaTtsModelDef
    & SplitVideoDef
    & MediaDef
    & SubtitleTimestampAdjustmentControllerDef
    & StorageDef
    & SettingsDef
    & ParakeetModelDef
    & ConvertDef
    & FavoriteClipsDef
    & TagDef
    & VocabularyDef
    & VideoLearningDef;

// 更新 ApiMap 类型以使用 CombinedApiDefinitions
export type ApiMap = {
    [K in keyof ApiDefinitions]: ApiFunction<ApiDefinitions[K]['params'], Promise<ApiDefinitions[K]['return']>>;
}

// 定义函数类型
type ApiFunction<P, R> = (params: P) => R;
