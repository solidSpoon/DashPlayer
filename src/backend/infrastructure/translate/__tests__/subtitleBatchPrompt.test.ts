import { describe, expect, it } from 'vitest';
import {
    buildLocalSubtitleFillGrammar,
    buildLocalSubtitleFillPrompt,
    parseLocalSubtitleFill,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';

/** 构造本地填槽提示词的最小语义输入；mode 决定目标语言。 */
const fillInput = (texts: string[], mode: 'zh' | 'simple_en' | 'custom' = 'zh') => ({
    targets: texts.map((text, index) => ({ key: `k${index}`, text })),
    contextBefore: [],
    contextAfter: [],
    mode,
});

/** 与 grammar 构造一致的提示词骨架，用于 round-trip 校验。 */
const buildSkeleton = (sources: string[]): string =>
    `{"items":[${sources.map((source) => `{"source": ${JSON.stringify(source)}, "translation": ""}`).join(', ')}]}`;

describe('本地填槽语法构造', () => {
    it('骨架字面量与译文自由段交替，槽数与源文逐字固定', () => {
        const grammar = buildLocalSubtitleFillGrammar(['hello world.', 'second line.']);
        expect(grammar).toBe(
            'root ::= "{\\"items\\":[{\\"source\\": \\"hello world.\\", \\"translation\\": \\"" tran '
            + '"\\"},{\\"source\\": \\"second line.\\", \\"translation\\": \\"" tran "\\"}]}"\n'
            + 'tran ::= [^"\\\\]{1,200}',
        );
    });

    it('单槽批次不产生槽间字面量', () => {
        const grammar = buildLocalSubtitleFillGrammar(['only line.']);
        expect(grammar).toBe(
            'root ::= "{\\"items\\":[{\\"source\\": \\"only line.\\", \\"translation\\": \\"" tran "\\"}]}"\n'
            + 'tran ::= [^"\\\\]{1,200}',
        );
    });

    it('源文转义后进入字面量，字面量解码序列可被解析侧按 JSON 回读', () => {
        const sources = ['He said "go" \\ now.', 'plain line.'];
        const grammar = buildLocalSubtitleFillGrammar(sources);
        // GBNF 字符串字面量转义与 JSON 兼容，直接用 JSON.parse 还原固定文本。
        const literals = grammar.split('\n')[0]
            .replace(/^root ::= /, '')
            .split(' tran ')
            .map((literal) => JSON.parse(literal) as string);
        // 字面量解码后拼上任意译文，即是解析侧期望的原始输出形状。
        const raw = literals[0] + '他说走。' + literals[1] + '现在。' + literals[2];
        expect(parseLocalSubtitleFill(raw, sources)).toEqual(['他说走。', '现在。']);
        // 解码后的骨架里，源文必须是 JSON.stringify 的形态（双引号与反斜杠已转义）。
        expect(literals[0]).toContain('"He said \\"go\\" \\\\ now."');
    });

    it('空槽数显式报错', () => {
        expect(() => buildLocalSubtitleFillGrammar([])).toThrow('非法的字幕批次槽数');
    });
});

describe('本地填槽提示词拼装', () => {
    it('骨架带空 translation 字段，源文逐字预填', () => {
        const prompt = buildLocalSubtitleFillPrompt(
            fillInput(['first line.', 'second line.']),
            '自然口语化',
            { forbidEcho: true },
        );
        expect(prompt).toContain(buildSkeleton(['first line.', 'second line.']));
        expect(prompt).toContain('"translation": ""');
    });

    it('中文模式嵌入简体中文目标语言标签', () => {
        const prompt = buildLocalSubtitleFillPrompt(fillInput(['hello.']), '自然口语化');
        expect(prompt).toContain('into Simplified Chinese');
        expect(prompt).not.toContain('The translated sentence in');
    });

    it('禁照抄开关注入正向禁照抄规则，关闭时允许原文返回', () => {
        const forbidden = buildLocalSubtitleFillPrompt(fillInput(['hello.']), '自然口语化', { forbidEcho: true });
        expect(forbidden).toContain('copying a source text as its own translation is forbidden');
        const allowed = buildLocalSubtitleFillPrompt(fillInput(['hello.']), '自然口语化');
        expect(allowed).toContain('If a source should remain unchanged, copy it into the translation field.');
    });

    it('只读上下文标注不输出', () => {
        const prompt = buildLocalSubtitleFillPrompt(
            {
                ...fillInput(['hello.']),
                contextBefore: [{ key: 'prev', text: 'previous sentence.' }],
            },
            '自然口语化',
        );
        expect(prompt).toContain('Context before (read-only, do NOT translate or output): previous sentence.');
    });
});

describe('本地填槽输出解析', () => {
    it('合法填槽输出返回按槽序排列的译文，并 trim 首尾空白', () => {
        const sources = ['hello.', 'world.'];
        const text = '{"items":[{"source": "hello.", "translation": " 你好。"},{"source": "world.", "translation": "世界。"}]}';
        expect(parseLocalSubtitleFill(text, sources)).toEqual(['你好。', '世界。']);
    });

    it('输出不是合法 JSON 时显式报错', () => {
        expect(() => parseLocalSubtitleFill('not json', ['hello.'])).toThrow('不是合法 JSON');
    });

    it('形状不符（缺字段/类型错误）显式报错', () => {
        expect(() => parseLocalSubtitleFill('{"items":[{"key":"k"}]}', ['hello.'])).toThrow('形状不符');
    });

    it('槽数与目标不一致时显式报错，不做静默对齐', () => {
        const text = '{"items":[{"source": "a.", "translation": "甲"}]}';
        expect(() => parseLocalSubtitleFill(text, ['a.', 'b.'])).toThrow('槽数不匹配');
    });

    it('源文回显错位时显式报错，防御推理端未按约束解码', () => {
        const text = '{"items":[{"source": "错位的源文.", "translation": "甲"}]}';
        expect(() => parseLocalSubtitleFill(text, ['a.'])).toThrow('源文错位');
    });
});
