import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import type LocalAiService from '@/backend/services/LocalAiService';
import LocalSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalSubtitleBatchTranslator';
import {
    LocalSubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';
import {
    buildLocalSubtitleFillGrammar,
    buildLocalSubtitleFillPrompt,
    LOCAL_TRANSLATION_TEMPERATURE,
    parseLocalSubtitleFill,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';
import { getMainLogger } from '@/backend/infrastructure/logger';

/**
 * 照抄检测前对文本做的归一化：剥离所有非字母数字字符（含标点、空白）
 * 并转小写，避免“原文加个句号就绕过检测”的漏网。
 */
const normalizeForEchoCheck = (text: string): string =>
    text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();

/** 文本是否包含 CJK 字符（即中文产物）。 */
const hasCjk = (text: string): boolean => /[\u4e00-\u9fff]/.test(text);

/** 源句是否是足够的西文句子（字母数达标），纯数字/短标记不在此列。 */
const isLatinSentence = (text: string): boolean =>
    (text.match(/[A-Za-z\u00C0-\u024F]/g) ?? []).length >= 4;

/**
 * 判断译文是否可用于中文模式：源句本身已是中文时原样返回属预期；
 * 西文句子的译文必须产出 CJK，且归一化后不得与原文相同。
 *
 * @returns 可用返回 true；不可用返回 false（视为照抄/未翻译）。
 */
const isUsableZhTranslation = (source: string, translation: string): boolean => {
    if (hasCjk(source)) return true;
    if (isLatinSentence(source) && !hasCjk(translation)) return false;
    return normalizeForEchoCheck(translation) !== normalizeForEchoCheck(source);
};

/**
 * 本地字幕批量翻译网关：源文锚定填槽策略（源文预拼进 JSON 骨架，
 * GBNF 在解码层强制骨架，模型只填 translation 槽）。
 *
 * 推理进程、模型加载与请求超时都由 LocalAiRuntime 管理；这里负责把语义输入
 * 拼成本地模型可执行的提示词与语法，并校验输出。字幕按 5 句一组整批发送。
 * 译文照抄原文时显式报错交由调度器重试，业务层不感知。历史行式方案在
 * 长行悬挂收尾的批次会合译后用回抄英文凑行数，填槽把每条译文的生成
 * 条件锚在自己源文上，从解码层消除该失败类（对比数据见本地链路评测
 * 脚本）。
 */
@injectable()
export default class LocalSubtitleBatchTranslatorImpl
implements LocalSubtitleBatchTranslator {
    /** 注入本地推理服务。 */
    public constructor(
        @inject(TYPES.LocalAiService) private readonly localAi: LocalAiService,
    ) {}

    private readonly logger = getMainLogger('LocalSubtitleBatchTranslator');

    /**
     * 执行一次非流式填槽批量翻译。
     *
     * @param input 当前组、组前后句、模式、风格、使用中模型与取消信号。
     * @returns 按目标顺序对齐的结构化字幕条目；结构校验不符时显式报错。
     */
    public async translate(
        input: LocalSubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]> {
        const sources = input.targets.map((target) => target.text);
        const prompt = buildLocalSubtitleFillPrompt(input, input.style, {
            forbidEcho: input.mode === 'zh',
        });
        const grammar = buildLocalSubtitleFillGrammar(sources);
        const text = await this.localAi.generateText(prompt, input.modelId, input.signal, {
            grammar,
            temperature: LOCAL_TRANSLATION_TEMPERATURE,
        });
        let translations: string[];
        try {
            translations = parseLocalSubtitleFill(text, sources);
        } catch (error) {
            // 解析失败时把模型原始输出按行落盘留归因证据（长文本以行数组入日志，
            // 避免单字段长度上限截掉尾部）；语法约束下该分支属于纯防御。
            this.logger.warn('local subtitle fill parse failed', {
                model: input.modelId,
                mode: input.mode,
                expected: sources.length,
                rawLines: text.trim().split('\n'),
                error,
            });
            throw error;
        }
        const items = input.targets.map((target, index) => ({
            key: target.key,
            translation: translations[index],
        }));
        if (input.mode === 'zh') {
            this.throwIfEchoed(input.targets, items);
        }
        return items;
    }

    /**
     * 整批结果的照抄检测：任一句译文与原文相同即显式报错。
     *
     * @param targets 发给模型的目标条目。
     * @param items 按序对齐后的结构化条目。
     */
    private throwIfEchoed(
        targets: LocalSubtitleBatchTranslationInput['targets'],
        items: SubtitleTranslationResultItem[],
    ): void {
        for (const [index, target] of targets.entries()) {
            if (!isUsableZhTranslation(target.text, items[index].translation)) {
                throw new Error(`本地模型照抄原文未翻译（sentenceKey=${target.key}）`);
            }
        }
    }
}
