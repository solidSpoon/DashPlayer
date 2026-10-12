import fs from 'node:fs';

import Database from 'better-sqlite3';
import { inject, injectable } from 'inversify';

import BuiltinDictionaryStore from '@/backend/services/gateways/translate/BuiltinDictionaryStore';
import { lemmatizeWord } from '@/backend/utils/language/VocabularyMatcher';
import { getMainLogger } from '@/backend/infrastructure/logger';
import TYPES from '@/backend/ioc/types';
import { OpenAIDictionaryDefinition, OpenAIDictionaryResult } from '@/common/types/DictionaryResult';
import {
    BuiltinDictionaryMeta,
    BUILTIN_DICTIONARY_SCHEMA_VERSION,
} from '@/backend/infrastructure/translate/builtinDictionarySchema';

/**
 * entries 表查询行的原始形状（与 builtinDictionarySchema.ts 的建表语句对应）。
 */
interface BuiltinDictionaryRow {
    word: string;
    phonetic: string;
    translation: string;
    collins: number;
    oxford: number;
    bnc: number;
    frq: number;
    tags: string;
    exchange: string;
}

/**
 * 将 ECDICT 的多行中文释义拆成单词卡释义列表。
 *
 * 行为说明：
 * - 每行形如 "n. 取消" / "vt. 删去"，识别行首小写词性前缀（如 n./vt./adj.）后拆分为词性与释义；
 * - 识别不到词性前缀的行（如 "[计] 作废"）词性留空，释义整行保留；
 * - 空行直接丢弃。
 *
 * @param translation 多行中文释义原文。
 * @returns 单词卡释义列表；输入为空时返回空数组。
 */
export const parseBuiltinTranslation = (translation: string): OpenAIDictionaryDefinition[] => {
    const definitions: OpenAIDictionaryDefinition[] = [];
    for (const rawLine of translation.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line) continue;

        const match = line.match(/^([a-z]{1,8}\.)\s*(.+)$/u);
        if (match) {
            definitions.push({ partOfSpeech: match[1], meaning: match[2].trim(), examples: [] });
        } else {
            definitions.push({ partOfSpeech: '', meaning: line, examples: [] });
        }
    }
    return definitions;
};

/**
 * 预置词典只读存储实现。
 *
 * 行为说明：
 * - SQLite 连接在首次查询时懒加载（同步、微秒级），避免拖慢启动；
 * - 查询顺序为「精确键 → 词形索引 → 分词器词形还原」：词形索引来自构建期从 ECDICT
 *   exchange 展开的 word_form 表，能确定性命中复数、时态等变体，排在分词器兜底之前；
 * - 打开时校验 meta 表的 schema_version，缺失或不匹配立即抛错；
 *   预置数据随应用打包，缺失意味着打包问题，必须显式暴露而不是回退到在线查询；
 * - 依赖通过构造函数注入（dbPath 由 IOC 绑定为运行时资源路径）。
 */
@injectable()
export class BuiltinDictionaryStoreImpl implements BuiltinDictionaryStore {
    private readonly logger = getMainLogger('BuiltinDictionaryStoreImpl');
    private readonly dbPath: string;
    private db: Database.Database | null = null;
    private selectStmt: Database.Statement | null = null;
    private selectFormStmt: Database.Statement | null = null;

    constructor(@inject(TYPES.BuiltinDictionaryPath) dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * 查词：精确键 → 词形索引 → 分词器词形还原。
     *
     * 词形索引命中时返回的是原形词条（查 "cats" 得到 "cat" 的单词卡），
     * 一个变形对应多个词条时按词频取首位（见 open 内的排序规则）。
     *
     * @param word 用户点击的单词原文。
     * @returns 命中的单词卡；未命中返回 null。
     */
    public lookup(word: string): OpenAIDictionaryResult | null {
        const normalized = (word ?? '').toLowerCase().trim();
        if (!normalized) {
            return null;
        }

        this.open();
        const row = this.select(this.selectStmt!, normalized)
            ?? this.select(this.selectFormStmt!, normalized)
            ?? this.select(this.selectStmt!, lemmatizeWord(normalized));
        if (!row) {
            return null;
        }

        const definitions = parseBuiltinTranslation(row.translation);
        if (definitions.length === 0) {
            // 无中文释义的词条对单词卡没有价值，视为未命中，走在线链路兜底
            return null;
        }

        const result: OpenAIDictionaryResult = {
            word: row.word,
            phonetic: row.phonetic ?? '',
            definitions,
        };
        if (row.collins > 0) result.collins = row.collins;
        if (row.oxford > 0) result.oxford = row.oxford;
        if (row.bnc > 0) result.bnc = row.bnc;
        if (row.frq > 0) result.frq = row.frq;
        const tags = (row.tags ?? '').split(/\s+/u).filter(Boolean);
        if (tags.length > 0) result.tags = tags;
        return result;
    }

    /**
     * 懒加载数据库连接并校验数据版本。
     *
     * @returns 只读连接。
     * @throws 数据文件缺失、meta 表缺失或 schema 版本不匹配时抛错。
     */
    private open(): Database.Database {
        if (this.db) {
            return this.db;
        }

        if (!fs.existsSync(this.dbPath)) {
            throw new Error(`预置词典数据文件缺失: ${this.dbPath}`);
        }

        const db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
        const meta = this.readMeta(db);
        if (meta.schemaVersion !== BUILTIN_DICTIONARY_SCHEMA_VERSION) {
            db.close();
            throw new Error(
                `预置词典数据版本不匹配: 期望 ${BUILTIN_DICTIONARY_SCHEMA_VERSION}, 实际 ${meta.schemaVersion}，请重新构建 dictionary.sqlite`
            );
        }

        this.db = db;
        this.selectStmt = db.prepare(
            'SELECT word, phonetic, translation, collins, oxford, bnc, frq, tags, exchange FROM entries WHERE word_key = ?'
        );
        // 一个变形可能对应多个词条，按「词频优先、BNC 兜底、词键收尾」取首个：
        // 词频信息缺失时统一排到末尾，保证同一份数据每次查询结果相同。
        this.selectFormStmt = db.prepare(
            `SELECT e.word, e.phonetic, e.translation, e.collins, e.oxford, e.bnc, e.frq, e.tags, e.exchange
             FROM word_form f JOIN entries e ON e.word_key = f.word_key
             WHERE f.inflected = ?
             ORDER BY CASE WHEN e.frq > 0 THEN e.frq WHEN e.bnc > 0 THEN e.bnc ELSE 999999 END, e.word_key
             LIMIT 1`
        );
        this.logger.debug('预置词典已加载', { dbPath: this.dbPath, wordCount: meta.wordCount });
        return db;
    }

    /**
     * 读取并校验 meta 表。
     *
     * @param db 只读连接。
     * @returns 预置词典元信息。
     */
    private readMeta(db: Database.Database): BuiltinDictionaryMeta {
        let rows: Array<{ key: string; value: string }>;
        try {
            rows = db.prepare('SELECT key, value FROM meta').all() as Array<{ key: string; value: string }>;
        } catch (error) {
            throw new Error(`预置词典数据缺少 meta 表: ${this.dbPath}`, { cause: error });
        }

        const map = new Map(rows.map((row) => [row.key, row.value]));
        const schemaVersion = Number(map.get('schema_version'));
        if (!Number.isInteger(schemaVersion)) {
            throw new Error(`预置词典数据缺少 schema_version: ${this.dbPath}`);
        }

        return {
            schemaVersion,
            source: map.get('source') ?? '',
            sourceVersion: map.get('source_version') ?? '',
            wordCount: Number(map.get('word_count') ?? 0),
            generatedAt: map.get('generated_at') ?? '',
        };
    }

    /**
     * 用预编译语句查询单条词条；查询失败视为未命中而不是错误。
     *
     * 两个语句返回的列与顺序一致，因此共用本方法的行映射。
     *
     * @param selectStmt 预编译查询语句（精确键或词形索引）。
     * @param key 查询键：精确查传小写词，词形查传小写变形词。
     * @returns 命中的词条行；未命中返回 null。
     */
    private select(selectStmt: Database.Statement, key: string): BuiltinDictionaryRow | null {
        if (!key) {
            return null;
        }
        const rows = selectStmt.all(key) as BuiltinDictionaryRow[];
        return rows.length > 0 ? rows[0] : null;
    }
}
