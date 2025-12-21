import fs from 'node:fs/promises';
import path from 'node:path';

import { count } from 'drizzle-orm';

import db from '@/backend/db';
import { words } from '@/backend/db/tables/words';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import SystemConfigServiceImpl from '@/backend/services/impl/SystemConfigServiceImpl';

export type DefaultVocabularyWord = {
    word: string;
    stem?: string;
    translate?: string;
    note?: string;
};

export const DEFAULT_VOCABULARY_VERSION = '1';
const SEED_VERSION_KEY = 'syssetup.vocabularySeedVersion';
const DEFAULT_VOCABULARY_JSONL_FILE_NAME = 'default-vocabulary.jsonl';

const isDev = process.env.NODE_ENV === 'development';
const DEFAULT_VOCABULARY_JSONL_PATH = isDev
    ? path.resolve('resources', DEFAULT_VOCABULARY_JSONL_FILE_NAME)
    : path.join(process.resourcesPath, 'resources', DEFAULT_VOCABULARY_JSONL_FILE_NAME);

const chunk = <T>(items: T[], size: number): T[][] => {
    if (size <= 0) return [items];
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
};

const loadDefaultVocabulary = async (): Promise<DefaultVocabularyWord[]> => {
    const content = await fs.readFile(DEFAULT_VOCABULARY_JSONL_PATH, 'utf-8');
    const lines = content
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const results: DefaultVocabularyWord[] = [];
    for (const line of lines) {
        const raw = JSON.parse(line) as unknown;
        if (!raw || typeof raw !== 'object') continue;

        const item = raw as Partial<DefaultVocabularyWord>;
        if (!item.word || typeof item.word !== 'string') continue;

        results.push({
            word: item.word,
            stem: item.stem,
            translate: item.translate,
            note: item.note,
        });
    }

    return results;
};

export const seedDefaultVocabularyIfNeeded = async (): Promise<void> => {
    const logger = getMainLogger('seedDefaultVocabulary');
    const sysConf = new SystemConfigServiceImpl();

    const seededVersion = await sysConf.getValue(SEED_VERSION_KEY);
    if (seededVersion === DEFAULT_VOCABULARY_VERSION) {
        logger.debug('skip seed: already seeded', { seededVersion });
        return;
    }

    const wordCount = db
        .select({ c: count() })
        .from(words)
        .get()?.c ?? 0;

    if (wordCount > 0) {
        logger.debug('skip seed: dp_words not empty', { wordCount, seededVersion });
        await sysConf.setValue(SEED_VERSION_KEY, DEFAULT_VOCABULARY_VERSION);
        return;
    }

    let defaults: DefaultVocabularyWord[];
    try {
        defaults = await loadDefaultVocabulary();
    } catch (error) {
        logger.error('load default vocabulary failed', { error });
        return;
    }

    if (defaults.length === 0) {
        logger.debug('skip seed: no default vocabulary entries');
        await sysConf.setValue(SEED_VERSION_KEY, DEFAULT_VOCABULARY_VERSION);
        return;
    }

    logger.info('seeding default vocabulary', {
        version: DEFAULT_VOCABULARY_VERSION,
        count: defaults.length,
    });

    const rows = defaults
        .map((w) => ({
            word: w.word.trim(),
            stem: (w.stem ?? w.word).trim(),
            translate: w.translate ?? null,
            note: w.note ?? null,
        }))
        .filter((w) => w.word.length > 0);

    for (const batch of chunk(rows, 300)) {
        await db
            .insert(words)
            .values(batch)
            .onConflictDoNothing();
    }

    await sysConf.setValue(SEED_VERSION_KEY, DEFAULT_VOCABULARY_VERSION);
    logger.info('seed done', { version: DEFAULT_VOCABULARY_VERSION });
};
