import registerRoute from '@/backend/controllers/ipc/registerRoute';
import { SrtSentence } from '@/common/types/SentenceC';
import { SentenceStruct } from '@/common/types/SentenceStruct';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/controllers/Controller';
import SubtitleService, {
    SubtitleVocabularyMatchResult,
} from '@/backend/services/SubtitleService';


@injectable()
export default class SubtitleController implements Controller {

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    /**
     * 为当前播放会话解析字幕。
     *
     * @param params 字幕路径、视频 ID 和字幕加载会话 ID。
     * @returns 已结构化的字幕；会话过期或没有字幕时返回 `null`。
     */
    public async parseSrt(params: {
        subtitlePath: string | null;
        videoId: string;
        playbackSessionId: string;
    }): Promise<SrtSentence | null> {
        return this.subtitleService.parseSrtForPlayback(
            params.subtitlePath,
            params.videoId,
            params.playbackSessionId,
        );
    }

    /**
     * 匹配已解析字幕中出现的用户生词。
     *
     * @param params 字幕哈希、视频 ID 和字幕加载会话 ID。
     * @returns 带字幕哈希的生词匹配结果。
     */
    public async matchVocabulary(params: {
        fileHash: string;
        videoId: string;
        playbackSessionId: string;
    }): Promise<SubtitleVocabularyMatchResult> {
        return this.subtitleService.matchVocabulary(
            params.fileHash,
            params.videoId,
            params.playbackSessionId,
        );
    }

    /**
     * 将任意英文文本解析为前端展示结构。
     *
     * @param texts 待解析文本数组。
     * @returns 与入参顺序一一对应的结构化句子。
     */
    public async parseStructs(texts: string[]): Promise<SentenceStruct[]> {
        return this.subtitleService.parseStructs(texts);
    }

    /**
     * 注册字幕相关 IPC 路由。
     */
    registerRoutes(): void {
        registerRoute('subtitle/srt/parse-to-sentences', (p) => this.parseSrt(p));
        registerRoute('subtitle/srt/match-vocabulary', (p) => this.matchVocabulary(p));
        registerRoute('subtitle/text/parse-structs', (p) => this.parseStructs(p));
    }
}
