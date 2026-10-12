import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import {
    BUILTIN_DICTIONARY_SCHEMA_SQL,
    BUILTIN_DICTIONARY_SCHEMA_VERSION,
    parseBuiltinExchangeForms,
} from '@/backend/infrastructure/translate/builtinDictionarySchema';

/**
 * 测试夹具中的预置词条。
 */
export interface FixtureBuiltinWord {
    /** 词典原始词形（保留大小写）。 */
    word: string;
    /** 音标。 */
    phonetic?: string;
    /** 多行中文释义原文。 */
    translation?: string;
    /** Collins 星级（1-5）。 */
    collins?: number;
    /** Oxford 收录标记（0-3）。 */
    oxford?: number;
    /** BNC 词频排名。 */
    bnc?: number;
    /** COCA 词频排名。 */
    frq?: number;
    /** 空格分隔的考试标签。 */
    tags?: string;
    /** 词形变化原文（ECDICT exchange）；夹具按与构建脚本相同的规则展开进 word_form。 */
    exchange?: string;
}

/**
 * 预置词典测试夹具句柄，用例结束后需调用 close 清理临时目录。
 */
export interface BuiltinDictionaryFixture {
    /** 夹具数据库文件路径，可直接交给 BuiltinDictionaryStoreImpl。 */
    dbPath: string;
    /** 删除临时目录。 */
    close: () => void;
}

/**
 * 在临时目录创建一份符合 schema 契约的预置词典 SQLite。
 *
 * 表结构直接使用 builtinDictionarySchema.ts 的 DDL，保证夹具与运行时契约一致；
 * 词形索引与构建脚本同规：由各词条的 exchange 展开，不单独传参，避免夹具与真实产物的
 * word_form 形态出现偏差。meta 默认写入当前契约版本，可通过 metaOverrides 覆盖以模拟版本
 * 不匹配等异常。
 *
 * @param words 预置词条列表。
 * @param metaOverrides meta 键值覆盖（如 { schema_version: '99' }）。
 * @returns 夹具句柄。
 */
export function createBuiltinDictionaryFixture(
    words: FixtureBuiltinWord[],
    metaOverrides: Record<string, string> = {},
): BuiltinDictionaryFixture {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-builtin-dict-'));
    const dbPath = path.join(dir, 'dictionary.sqlite');
    const db = new Database(dbPath);
    db.exec(BUILTIN_DICTIONARY_SCHEMA_SQL);

    const insertEntry = db.prepare(`
        INSERT INTO entries (word_key, word, phonetic, translation, collins, oxford, bnc, frq, tags, exchange)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertWordForm = db.prepare('INSERT INTO word_form (inflected, word_key) VALUES (?, ?)');
    for (const entry of words) {
        const wordKey = entry.word.toLowerCase();
        insertEntry.run(
            wordKey,
            entry.word,
            entry.phonetic ?? '',
            entry.translation ?? '',
            entry.collins ?? 0,
            entry.oxford ?? 0,
            entry.bnc ?? 0,
            entry.frq ?? 0,
            entry.tags ?? '',
            entry.exchange ?? '',
        );
        for (const form of parseBuiltinExchangeForms(entry.exchange ?? '')) {
            insertWordForm.run(form, wordKey);
        }
    }

    const meta: Record<string, string> = {
        schema_version: String(BUILTIN_DICTIONARY_SCHEMA_VERSION),
        source: 'ecdict',
        source_version: 'test',
        word_count: String(words.length),
        generated_at: '2025-01-01T00:00:00Z',
        ...metaOverrides,
    };
    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(meta)) {
        insertMeta.run(key, value);
    }

    db.close();
    return {
        dbPath,
        close: () => fs.rmSync(dir, { recursive: true, force: true }),
    };
}
