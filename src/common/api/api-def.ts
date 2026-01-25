import {DpTask} from '@/backend/infrastructure/db/tables/dpTask';
import {YdRes, OpenAIDictionaryResult} from '@/common/types/YdRes';
import {ChapterParseResult} from '@/common/types/chapter-result';
import {SrtSentence} from '@/common/types/SentenceC';
import {WindowState} from '@/common/types/Types';
import {
    InsertSubtitleTimestampAdjustment
} from '@/backend/infrastructure/db/tables/subtitleTimestampAdjustment';
import {SettingKey} from '@/common/types/store_schema';
import Release from '@/common/types/release';
import {FolderVideos} from '@/common/types/tonvert-type';

import {Tag} from '@/backend/infrastructure/db/tables/tag';
import {ClipQuery, SimpleClipQuery} from '@/common/api/dto';
import {ClipMeta, OssBaseMeta} from '@/common/types/clipMeta';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import {VideoLearningClipPage} from '@/common/types/vo/VideoLearningClipVO';
import {VideoLearningClipStatusVO} from '@/common/types/vo/VideoLearningClipStatusVO';
import { ChatStartParams, ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';
import {ApiSettingVO} from "@/common/types/vo/api-setting-vo";
import { WhisperModelStatusVO, WhisperModelSize, WhisperVadModel } from '@/common/types/vo/whisper-model-vo';
import { VideoInfo } from '@/common/types/video-info';

interface ApiDefinition {
    'eg': { params: string, return: number },
}

// 定义额外的接口
interface AiFuncDef {
    'ai-func/tts': { params: string, return: string };
    'ai-func/format-split': { params: string, return: number };
    'ai-func/transcript': { params: { filePath: string }, return: void };
    'ai-func/cancel-transcription': { params: { filePath: string }, return: boolean };
    'ai-func/get-active-transcription-tasks': { params: void, return: unknown[] };
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
    'system/check-update': { params: void, return: Release[] };
    'system/open-url': { params: string, return: void };
    'system/app-version': { params: void, return: string };
    'system/test-renderer-api': { params: void, return: void };
}

interface AiTransDef {
    'ai-trans/batch-translate': { params: string[], return: Map<string, string> };
    'ai-trans/word': {
        params: { word: string; forceRefresh?: boolean; requestId?: string },
        return: YdRes | OpenAIDictionaryResult | null
    };
    // 新的翻译接口 - 按组请求翻译(立即返回，后端异步处理)
    'ai-trans/request-group-translation': {
        params: {
            fileHash: string,
            indices: number[],
            useCache?: boolean
        },
        return: void
    };
    // 测试腾讯翻译API
    'ai-trans/test-tencent': { params: void, return: void };
    // 测试新的翻译流程
    'ai-trans/test-new-flow': { params: void, return: void };
}

interface ChatDef {
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
    'watch-history/attach-srt': { params: { videoPath: string, srtPath: string | 'same' }, return: void };
    'watch-history/suggest-srt': { params: string, return: string[] };
    'watch-history/get-next-video': { params: string, return: WatchHistoryVO | null };
}

interface SubtitleControllerDef {
    'subtitle/srt/parse-to-sentences': { params: string, return: SrtSentence | null };
}

interface SubtitleTimestampAdjustmentControllerDef {
    'subtitle-timestamp/delete/by-file-hash': { params: string, return: void };
    'subtitle-timestamp/delete/by-key': { params: string, return: void };
    'subtitle-timestamp/update': { params: InsertSubtitleTimestampAdjustment, return: void };
}

interface StorageDef {
    'storage/put': { params: { key: SettingKey, value: string }, return: void };
    'storage/get': { params: SettingKey, return: string };
    'storage/cache/size': { params: void, return: string };
    'storage/collection/paths': { params: void, return: string[] };
}

interface SettingsDef {
    'settings/services/get-all': { params: void, return: ApiSettingVO };
    'settings/services/update': { params: { service: string, settings: ApiSettingVO }, return: void };
    'settings/services/test-openai': { params: void, return: { success: boolean, message: string } };
    'settings/services/test-tencent': { params: void, return: { success: boolean, message: string } };
    'settings/services/test-youdao': { params: void, return: { success: boolean, message: string } };
    'settings/appearance/update': { params: { theme: string; fontSize: string }, return: void };
    'settings/shortcuts/update': { params: Partial<Record<SettingKey, string>>, return: void };
    'settings/storage/update': { params: { path: string; collection: string }, return: void };
    'settings/translation/update': { params: { engine: 'tencent' | 'openai'; tencentSecretId?: string; tencentSecretKey?: string }, return: void };
    'settings/youdao/update': { params: { secretId: string; secretKey: string }, return: void };
}

interface WhisperModelDef {
    'whisper/models/status': { params: void, return: WhisperModelStatusVO };
    'whisper/models/download': { params: { modelSize: WhisperModelSize }, return: { success: boolean; message: string } };
    'whisper/models/download-vad': { params: { vadModel: WhisperVadModel }, return: { success: boolean; message: string } };
}

interface SplitVideoDef {
    'split-video/preview': { params: string, return: ChapterParseResult[] };
    'split-video/split': {
        params: { videoPath: string, srtPath: string | null, chapters: ChapterParseResult[] },
        return: string
    };
    'split-video/thumbnail': {
        params: {
            filePath: string,
            time: number,
            quality?: 'low' | 'medium' | 'high' | 'ultra',
            width?: number,
            format?: 'jpg' | 'png'
        },
        return: string
    };
    'split-video/video-length': { params: string, return: number };
}

interface ConvertDef {
    'convert/to-mp4': { params: string, return: number };
    'convert/from-folder': { params: string[], return: FolderVideos[] };
    'convert/video-length': { params: string, return: number };
    'convert/video-info': { params: string, return: VideoInfo };
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
    'video-learning/auto-clip': {
        params: { videoPath: string; srtKey: string; srtPath?: string },
        return: { success: boolean }
    };
    'video-learning/cancel-add': {
        params: { srtKey: string; indexInSrt: number },
        return: { success: boolean }
    };
    'video-learning/delete': {
        params: { key: string },
        return: { success: boolean }
    };
    'video-learning/search': {
        params: SimpleClipQuery,
        return: { success: boolean; data: VideoLearningClipPage }
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
    & DpTaskDef
    & SystemDef
    & AiTransDef
    & ChatDef
    & ChatAnalysisDef
    & WatchHistoryDef
    & SubtitleControllerDef
    & SplitVideoDef
    & SubtitleTimestampAdjustmentControllerDef
    & StorageDef
    & SettingsDef
    & WhisperModelDef
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
