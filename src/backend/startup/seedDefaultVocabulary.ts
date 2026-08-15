import { count } from 'drizzle-orm';

import db from '@/backend/infrastructure/db';
import { words } from '@/backend/infrastructure/db/tables/words';
import { getMainLogger } from '@/backend/infrastructure/logger';
import TYPES from '@/backend/ioc/types';
import container from '@/backend/ioc/inversify.config';
import SystemConfigService from '@/backend/services/SystemConfigService';
import { DefaultVocabularyWord, loadDefaultVocabulary } from '@/backend/utils/defaultVocabulary';

export const DEFAULT_VOCABULARY_VERSION = '1';
const SEED_VERSION_KEY = 'syssetup.vocabularySeedVersion';

const chunk = <T>(items: T[], size: number): T[][] => {
    if (size <= 0) return [items];
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
};

export const seedDefaultVocabularyIfNeeded = async (): Promise<void> => {
    const logger = getMainLogger('seedDefaultVocabulary');
    const sysConf = container.get<SystemConfigService>(TYPES.SystemConfigService);

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
            translate: w.translate ?? null,
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
