import {MsgT} from '@/common/types/msg/interfaces/MsgT';
import {DpTask} from '@/backend/db/tables/dpTask';
import {YdRes} from '@/common/types/YdRes';
import {WatchProjectVideo} from '@/backend/db/tables/watchProjectVideos';
import {SentenceStruct} from '@/common/types/SentenceStruct';
import {WatchProject} from '@/backend/db/tables/watchProjects';
import {WatchProjectVO} from '@/backend/services/WatchProjectNewService';
import {ChapterParseResult} from "@/common/types/chapter-result";

interface ApiDefinition {
    'eg': { params: string, return: number },
}

// 定义额外的接口
interface AiFuncDef {
    'ai-func/tts': { params: string, return: string };
    'ai-func/phrase-group': { params: string, return: number };
    'ai-func/polish': { params: string, return: number };
    'ai-func/make-example-sentences': { params: { sentence: string, point: string[] }, return: number };
    'ai-func/punctuation': { params: { no: number, srt: string }, return: number };
    'ai-func/analyze-grammars': { params: string, return: number };
    'ai-func/analyze-new-phrases': { params: string, return: number };
    'ai-func/analyze-new-words': { params: string, return: number };
    'ai-func/chat': { params: { msgs: MsgT[] }, return: number };
    'ai-func/transcript': { params: { filePath: string }, return: number };
    'ai-func/explain-select-with-context': { params: { sentence: string, selectedWord: string }, return: number };
    'ai-func/explain-select': { params: { word: string }, return: number };
}

interface DpTaskDef {
    'dp-task/detail': { params: number, return: DpTask | undefined };
    'dp-task/cancel': { params: number, return: void };
}

interface SystemDef {
    'system/is-windows': { params: void, return: boolean };
    'system/select-file': {
        params: { mode: 'file' | 'directory', filter: 'video' | 'srt' | 'none' },
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
}

interface AiTransDef {
    'ai-trans/batch-translate': { params: string[], return: Map<string, string> };
    'ai-trans/word': { params: string, return: YdRes | null };
}

interface WatchProjectDef {
    'watch-project/progress/update': {
        params: { videoId: number, currentTime: number, duration: number },
        return: void
    };
    'watch-project/video/play': { params: number, return: void };
    'watch-project/video/detail': { params: number, return: WatchProjectVideo };
    'watch-project/video/detail/by-pid': { params: number, return: WatchProjectVideo };
    'watch-project/create/from-folder': { params: string, return: number };
    'watch-project/create/from-files': { params: string[], return: number };
    'watch-project/delete': { params: number, return: void };
    'watch-project/detail': { params: number, return: WatchProjectVO };
    'watch-project/detail/by-vid': { params: number, return: WatchProjectVO };
    'watch-project/list': { params: void, return: WatchProject[] };
    'watch-project/attach-srt': { params: { videoPath: string, srtPath: string | 'same' }, return: void };
}

interface SubtitleControllerDef {
    'subtitle/sentences/process': { params: string[], return: SentenceStruct[] };
}

interface SplitVideoDef {
    'split-video/preview': { params: string, return: ChapterParseResult[] };
    'split-video/split-one': {
        params: { videoPath: string, srtPath: string | null, chapter: ChapterParseResult },
        return: number
    };
    'split-video/thumbnail': { params: { filePath: string, time: number }, return: string };
}

// 使用交叉类型合并 ApiDefinitions 和 ExtraApiDefinition
export type ApiDefinitions = ApiDefinition
    & AiFuncDef
    & DpTaskDef
    & SystemDef
    & AiTransDef
    & WatchProjectDef
    & SubtitleControllerDef
    & SplitVideoDef;

// 更新 ApiMap 类型以使用 CombinedApiDefinitions
export type ApiMap = {
    [K in keyof ApiDefinitions]: ApiFunction<ApiDefinitions[K]['params'], Promise<ApiDefinitions[K]['return']>>;
}

// 定义函数类型
type ApiFunction<P, R> = (params: P) => R;
