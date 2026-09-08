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
export const BUILTIN_DICTIONARY_SCHEMA_VERSION = 1;

/**
 * 预置词典建表语句。
 *
 * 表结构说明：
 * - entries.word_key：小写化的查询键（主键），消除大小写差异；
 * - entries.word：词典原始词形（保留大小写，用于卡片展示）；
 * - entries.translation：ECDICT 多行中文释义原文，每行一条释义，运行时按行解析；
 * - entries.tags：空格分隔的考试标签（zk/gk/cet4/cet6/ky/toefl/ielts/gre）；
 * - entries.exchange：ECDICT 词形变化原文，当前仅存档，供后续变体直查使用。
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
