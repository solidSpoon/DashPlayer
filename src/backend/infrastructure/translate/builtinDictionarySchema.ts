/**
 * 预置词典 SQLite 的 schema 契约。
 *
 * 该文件是运行时（BuiltinDictionaryStoreImpl）与测试夹具的共同契约；
 * 构建脚本 scripts/build-dictionary.mjs 是独立 Node 脚本，无法直接 import TS，
 * 其中的 DDL 与 schema_version 需与本文件保持一致（脚本内有注释互指）。
 */

/**
 * 预置词典数据结构版本。
 *
 * 生成逻辑或表结构变化时递增；运行时发现版本不匹配会显式报错，
 * 需要重新执行构建脚本并提交新的 dictionary.sqlite。
 */
export const BUILTIN_DICTIONARY_SCHEMA_VERSION = 2;

/**
 * ECDICT exchange 中参与词形索引的类型码。
 *
 * 只收录 p/d/i/3/r/t/s（过去式 / 过去分词 / 现在分词 / 三单 / 比较级 / 最高级 / 复数），
 * 它们的值一定是单词形态；`0`（Lemma 指针）与 `1`（Lemma 的变换形式，值是 "s"/"d" 这类
 * 类型字母而非单词）刻意不收——`1` 的值收进去只会污染索引，而 `0` 指向的原形词条若也在
 * 收录子集内，该变形已被原形词条自身的 exchange 覆盖。
 */
export const BUILTIN_DICTIONARY_WORD_FORM_TYPES = ['p', 'd', 'i', '3', 'r', 't', 's'] as const;

/**
 * 解析 ECDICT exchange 原文，取出去重后的变形词（一律小写）。
 *
 * 原文形如 "p:drawled/3:drawls/i:drawling"，以 "/" 分隔片段、片段内以 ":" 分隔
 * 类型码与值；只保留 BUILTIN_DICTIONARY_WORD_FORM_TYPES 内的类型码，结构不合法的片段跳过。
 *
 * 构建脚本 scripts/build-dictionary.mjs 是独立 Node 脚本无法 import 本文件，内含一份等价
 * 实现，改规则时两边都要改（与 DDL 的同步约定相同）。
 *
 * @param exchange ECDICT exchange 原文。
 * @returns 去重后的变形词列表；输入为空或无可用片段时返回空数组。
 */
export const parseBuiltinExchangeForms = (exchange: string): string[] => {
    const forms: string[] = [];
    const seen = new Set<string>();
    for (const rawSegment of (exchange ?? '').split('/')) {
        const segment = rawSegment.trim();
        // 合法片段至少是 "<类型码>:<值>"，类型码为单个字符。
        if (segment.length < 3 || segment[1] !== ':') continue;
        if (!(BUILTIN_DICTIONARY_WORD_FORM_TYPES as readonly string[]).includes(segment[0])) continue;
        const form = segment.slice(2).trim().toLowerCase();
        if (!form || seen.has(form)) continue;
        seen.add(form);
        forms.push(form);
    }
    return forms;
};

/**
 * 预置词典建表语句。
 *
 * 表结构说明：
 * - entries.word_key：小写化的查询键（主键），消除大小写差异；
 * - entries.word：词典原始词形（保留大小写，用于卡片展示）；
 * - entries.translation：ECDICT 多行中文释义原文，每行一条释义，运行时按行解析；
 * - entries.tags：空格分隔的考试标签（zk/gk/cet4/cet6/ky/toefl/ielts/gre）；
 * - entries.exchange：ECDICT 词形变化原文，构建时按 parseBuiltinExchangeForms 展开进 word_form，
 *   运行时不再解析，仅存档备查；
 * - word_form.inflected：变形词（小写），一个变形可能对应多个词条（如 aches → ach/ache），
 *   查询按词频排序取首个；
 * - word_form.word_key：该变形对应的词条键，指向 entries.word_key。
 */
export const BUILTIN_DICTIONARY_SCHEMA_SQL = `
CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE entries (
    word_key TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    phonetic TEXT NOT NULL DEFAULT '',
    translation TEXT NOT NULL DEFAULT '',
    collins INTEGER NOT NULL DEFAULT 0,
    oxford INTEGER NOT NULL DEFAULT 0,
    bnc INTEGER NOT NULL DEFAULT 0,
    frq INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '',
    exchange TEXT NOT NULL DEFAULT ''
);
CREATE TABLE word_form (
    inflected TEXT NOT NULL,
    word_key TEXT NOT NULL
);
CREATE INDEX idx_word_form_inflected ON word_form (inflected);
`;

/**
 * 预置词典元信息。
 */
export interface BuiltinDictionaryMeta {
    /** 数据结构版本，对应 BUILTIN_DICTIONARY_SCHEMA_VERSION。 */
    schemaVersion: number;
    /** 数据来源标识（如 'ecdict'）。 */
    source: string;
    /** 数据源版本（如 '1.0.28'）。 */
    sourceVersion: string;
    /** 收录词条数。 */
    wordCount: number;
    /** 生成时间（UTC ISO 8601）。 */
    generatedAt: string;
}
