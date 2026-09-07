import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import type LocalAiService from '@/backend/services/LocalAiService';
import LocalSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalSubtitleBatchTranslator';
import {
    LocalSubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';
import {
    buildLocalSubtitleBatchPrompt,
    getSubtitleTranslationDescription,
    parseSubtitleBatchLines,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';

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
 * 本地字幕批量翻译网关：自持紧凑行式提示词拼装与按行解析。
 *
 * 推理进程、模型加载与请求超时都由 LocalAiRuntime 管理；这里负责把语义输入
 * 拼成本地模型可执行的提示词，并校验输出形状。字幕按 5 句一组整批发送，
 * 输出为「每行一条译文、按输入顺序对齐」的紧凑格式——不要求模型回抄字幕键
 * 与 JSON 结构，每批解码 token 约减半。译文照抄原文时显式报错交由调度器
 * 重试，业务层不感知。
 */
@injectable()
export default class LocalSubtitleBatchTranslatorImpl
implements LocalSubtitleBatchTranslator {
    /** 注入本地推理服务。 */
    public constructor(
        @inject(TYPES.LocalAiService) private readonly localAi: LocalAiService,
    ) {}

    /**
     * 执行一次非流式紧凑批量翻译。
     *
     * @param input 当前组、组前后句、模式、风格、使用中模型与取消信号。
     * @returns 按目标顺序对齐的结构化字幕条目；行数不符时显式报错。
     */
    public async translate(
        input: LocalSubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]> {
        const prompt = buildLocalSubtitleBatchPrompt(input, input.style, {
            forbidEcho: input.mode === 'zh',
            targetLanguageDescription: getSubtitleTranslationDescription(input.mode),
        });
        const text = await this.localAi.generateText(prompt, input.modelId, input.signal);
        const lines = parseSubtitleBatchLines(text, input.targets.length);
        const items = input.targets.map((target, index) => ({
            key: target.key,
            translation: lines[index],
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
