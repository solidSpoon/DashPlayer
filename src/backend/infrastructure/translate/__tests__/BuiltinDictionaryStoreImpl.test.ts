import fs from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

// 服务模块会经 simple-logger 依赖 electron（读取 userData 路径），
// 与 AiSdkUpgradeIntegration.test.ts 相同的 mock 约定，避免 require 真实 electron 可执行文件。
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: () => '/tmp/dashplayer-builtin-dict-test-userdata',
        getVersion: () => '6.1.0',
    },
    ipcMain: undefined,
    ipcRenderer: undefined,
}));

import {
    BuiltinDictionaryStoreImpl,
    parseBuiltinTranslation,
} from '@/backend/infrastructure/translate/BuiltinDictionaryStoreImpl';
import { parseBuiltinExchangeForms } from '@/backend/infrastructure/translate/builtinDictionarySchema';
import { createBuiltinDictionaryFixture } from '@/test/builtinDictionaryFixture';

describe('预置词典查询', () => {
    let closeFixture: (() => void) | null = null;

    afterEach(() => {
        closeFixture?.();
        closeFixture = null;
    });

    const buildStore = (words: Parameters<typeof createBuiltinDictionaryFixture>[0], metaOverrides?: Record<string, string>) => {
        const fixture = createBuiltinDictionaryFixture(words, metaOverrides);
        closeFixture = fixture.close;
        return new BuiltinDictionaryStoreImpl(fixture.dbPath);
    };

    it('命中词条时返回带词库元信息的简化单词卡', () => {
        const store = buildStore([
            {
                word: 'cancel',
                phonetic: "'kænsәl",
                translation: 'n. 取消, 撤消\nvt. 取消, 删去\n[计] 作废',
                collins: 3,
                oxford: 1,
                bnc: 3183,
                frq: 3915,
                tags: 'zk gk cet4 cet6',
                exchange: 'd:cancelled/p:cancelled/i:cancelling/3:cancels/s:cancels',
            },
        ]);

        const result = store.lookup('cancel');

        expect(result).not.toBeNull();
        expect(result?.word).toBe('cancel');
        expect(result?.phonetic).toBe("'kænsәl");
        expect(result?.definitions).toEqual([
            { partOfSpeech: 'n.', meaning: '取消, 撤消', examples: [] },
            { partOfSpeech: 'vt.', meaning: '取消, 删去', examples: [] },
            { partOfSpeech: '', meaning: '[计] 作废', examples: [] },
        ]);
        expect(result?.collins).toBe(3);
        expect(result?.oxford).toBe(1);
        expect(result?.bnc).toBe(3183);
        expect(result?.frq).toBe(3915);
        expect(result?.tags).toEqual(['zk', 'gk', 'cet4', 'cet6']);
    });

    it('大小写和首尾空白不影响查询', () => {
        const store = buildStore([
            { word: 'China', phonetic: '', translation: 'n. 中国', bnc: 500 },
        ]);

        expect(store.lookup('  china ')?.word).toBe('China');
        expect(store.lookup('CHINA')?.word).toBe('China');
    });

    it('变体词命中词形索引时返回原形词条', () => {
        const store = buildStore([
            {
                word: 'cat',
                phonetic: 'kæt',
                translation: 'n. 猫',
                collins: 5,
                exchange: 's:cats/i:catting/p:catted/3:cats/d:catted',
            },
        ]);

        expect(store.lookup('cats')?.word).toBe('cat');
        expect(store.lookup('catting')?.word).toBe('cat');
        expect(store.lookup('catted')?.collins).toBe(5);
    });

    it('一个变形对应多个词条时返回词频更高的那个', () => {
        // some 是两个词条共同的变形（ECDICT 真实标注噪声），分词器不会把 some 还原到 a/an，
        // 这条只有词形索引能命中，同时钉住一对多时的词频优先规则。
        const store = buildStore([
            { word: 'a', phonetic: '', translation: 'art. 一', frq: 5, exchange: 's:some' },
            { word: 'an', phonetic: '', translation: 'art. 一个', frq: 40, exchange: 's:some' },
        ]);

        expect(store.lookup('some')?.word).toBe('a');
    });

    it('变形词无词形索引时按分词器还原的原形回退查询', () => {
        const store = buildStore([
            { word: 'book', phonetic: '', translation: 'n. 书', collins: 4 },
            { word: 'go', phonetic: '', translation: 'vi. 去', bnc: 800 },
        ]);

        expect(store.lookup('books')?.word).toBe('book');
        expect(store.lookup('went')?.word).toBe('go');
    });

    it('变体自身有词条时优先返回变体自己的释义', () => {
        const store = buildStore([
            { word: 'book', phonetic: '', translation: 'n. 书' },
            { word: 'books', phonetic: '', translation: 'n. 账目' },
        ]);

        expect(store.lookup('books')?.definitions).toEqual([
            { partOfSpeech: 'n.', meaning: '账目', examples: [] },
        ]);
    });

    it('没有中文释义的词条视为未命中', () => {
        const store = buildStore([
            { word: 'emptyword', phonetic: '', translation: '' },
        ]);

        expect(store.lookup('emptyword')).toBeNull();
    });

    it('完全未命中的单词返回 null', () => {
        const store = buildStore([
            { word: 'cancel', phonetic: '', translation: 'n. 取消' },
        ]);

        expect(store.lookup('unknownword')).toBeNull();
        expect(store.lookup('')).toBeNull();
    });

    it('数据版本不匹配时显式抛错', () => {
        const store = buildStore(
            [{ word: 'cancel', phonetic: '', translation: 'n. 取消' }],
            { schema_version: '999' },
        );

        expect(() => store.lookup('cancel')).toThrow(/版本不匹配/);
    });

    it('数据文件缺失时显式抛错', () => {
        const missingPath = '/nonexistent/dashplayer/dictionary.sqlite';
        const store = new BuiltinDictionaryStoreImpl(missingPath);

        expect(() => store.lookup('cancel')).toThrow(/缺失/);
        expect(fs.existsSync(missingPath)).toBe(false);
    });
});

describe('预置词典释义解析', () => {
    it('空释义解析为空列表', () => {
        expect(parseBuiltinTranslation('')).toEqual([]);
        expect(parseBuiltinTranslation('  \n  ')).toEqual([]);
    });

    it('识别不到词性前缀的行整体作为释义', () => {
        expect(parseBuiltinTranslation('（事件）意外地发生')).toEqual([
            { partOfSpeech: '', meaning: '（事件）意外地发生', examples: [] },
        ]);
    });
});

describe('预置词典 exchange 展开', () => {
    it('展开时态、复数等变形词并去重', () => {
        expect(parseBuiltinExchangeForms('s:cats/i:catting/p:catted/3:cats/d:catted')).toEqual([
            'cats',
            'catting',
            'catted',
        ]);
    });

    it('跳过 Lemma 指针与结构不合法的片段', () => {
        // 0 是 Lemma 指针，1 的值是类型字母而非单词，两者都不进词形索引。
        expect(parseBuiltinExchangeForms('0:draw/1:d')).toEqual([]);
        expect(parseBuiltinExchangeForms('x:whatever/p:')).toEqual([]);
        expect(parseBuiltinExchangeForms('')).toEqual([]);
    });

    it('变形词统一小写并清理空白', () => {
        expect(parseBuiltinExchangeForms(' s: Cats / i: Catting ')).toEqual(['cats', 'catting']);
    });
});
