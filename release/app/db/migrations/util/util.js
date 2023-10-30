const createAtTimestampTrigger = (tableName) => {
    return `
        CREATE TRIGGER set_created_at_timestamp_for_${tableName}
        AFTER INSERT ON ${tableName}
        BEGIN
            UPDATE ${tableName} SET created_at = datetime('now', '+8 hours') WHERE rowid = new.rowid;
        END;
        `;
};
export { createAtTimestampTrigger };
const updateAtTimestampTrigger = (tableName) => {
    return `
        CREATE TRIGGER set_updated_at_timestamp_for_${tableName}
        AFTER UPDATE ON ${tableName}
        BEGIN
            UPDATE ${tableName} SET updated_at = datetime('now', '+8 hours') WHERE rowid = new.rowid;
        END;
        `;
};
export { updateAtTimestampTrigger };
export const SENTENCE_TRANSLATE_TABLE_NAME = 'dp_sentence_translate';
export const WORD_TRANSLATE_TABLE_NAME = 'dp_word_translate';
