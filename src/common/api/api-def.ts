import { DpTask } from '@/backend/db/tables/dpTask';
import { YdRes } from '@/common/types/YdRes';
import { ChapterParseResult } from '@/common/types/chapter-result';
import { SrtSentence } from '@/common/types/SentenceC';
import { WindowState } from '@/common/types/Types';
import {
    InsertSubtitleTimestampAdjustment
} from '@/backend/db/tables/subtitleTimestampAdjustment';
import { SettingKey } from '@/common/types/store_schema';
import Release from '@/common/types/release';
import { FolderVideos } from '@/common/types/tonvert-type';

import { Tag } from '@/backend/db/tables/tag';
import { ClipQuery } from '@/common/api/dto';
import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import { COOKIE } from '@/common/types/DlVideoType';
import { CoreMessage } from 'ai';

interface ApiDefinition {
    'eg': { params: string, return: number },
}

// 定义额外的接口
interface AiFuncDef {
    'ai-func/tts': { params: string, return: string };
    'ai-func/phrase-group': { params: string, return: number };
    'ai-func/polish': { params: string, return: number };
    'ai-func/format-split': { params: string, return: number };
    'ai-func/make-example-sentences': { params: { sentence: string, point: string[] }, return: number };
    'ai-func/punctuation': { params: { no: number, srt: string }, return: number };
    'ai-func/analyze-grammars': { params: string, return: number };
    'ai-func/analyze-new-phrases': { params: string, return: number };
    'ai-func/analyze-new-words': { params: string, return: number };
    'ai-func/chat': { params: { msgs: CoreMessage[] }, return: number };
    'ai-func/transcript': { params: { filePath: string }, return: number };
    'ai-func/explain-select-with-context': { params: { sentence: string, selectedWord: string }, return: number };
    'ai-func/explain-select': { params: { word: string }, return: number };
    'ai-func/translate-with-context': { params: { sentence: string, context: string[] }, return: number };
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
    'system/check-update': { params: void, return: Release[] };
    'system/open-url': { params: string, return: void };
    'system/app-version': { params: void, return: string };
    'system/test-renderer-api': { params: void, return: void };
}

interface AiTransDef {
    'ai-trans/batch-translate': { params: string[], return: Map<string, string> };
    'ai-trans/word': { params: string, return: YdRes | null };
    // 新的翻译接口 - 按组请求翻译(立即返回，后端异步处理)
    'ai-trans/request-group-translation': { 
        params: { 
            engine: 'tencent' | 'openai',
            translations: Array<{ key: string, sentences: string[] }>
        }, 
        return: void 
    };
    // 测试腾讯翻译API
    'ai-trans/test-tencent': { params: void, return: void };
    // 测试新的翻译流程
    'ai-trans/test-new-flow': { params: void, return: void };
}

interface WatchHistoryDef {
    'watch-history/list': { params: string, return: WatchHistoryVO[] };
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
    'watch-history/analyse-folder': { params: string, return: { supported: number, unsupported: number } };
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

interface SplitVideoDef {
    'split-video/preview': { params: string, return: ChapterParseResult[] };
    'split-video/split': {
        params: { videoPath: string, srtPath: string | null, chapters: ChapterParseResult[] },
        return: string
    };
    'split-video/thumbnail': { params: { filePath: string, time: number }, return: string };
    'split-video/video-length': { params: string, return: number };
}

interface DownloadVideoDef {
    'download-video/url': { params: { url: string, cookies: COOKIE }, return: number };
}

interface ConvertDef {
    'convert/to-mp4': { params: string, return: number };
    'convert/from-folder': { params: string[], return: FolderVideos[] };
    'convert/video-length': { params: string, return: number };

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


// 使用交叉类型合并 ApiDefinitions 和 ExtraApiDefinition
export type ApiDefinitions = ApiDefinition
    & AiFuncDef
    & DpTaskDef
    & SystemDef
    & AiTransDef
    & WatchHistoryDef
    & SubtitleControllerDef
    & SplitVideoDef
    & SubtitleTimestampAdjustmentControllerDef
    & StorageDef
    & DownloadVideoDef
    & ConvertDef
    & FavoriteClipsDef
    & TagDef;

// 更新 ApiMap 类型以使用 CombinedApiDefinitions
export type ApiMap = {
    [K in keyof ApiDefinitions]: ApiFunction<ApiDefinitions[K]['params'], Promise<ApiDefinitions[K]['return']>>;
}

// 定义函数类型
type ApiFunction<P, R> = (params: P) => R;
