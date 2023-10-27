const createAtTimestampTrigger = (tableName: string) => {
    return `
        CREATE TRIGGER set_created_at_timestamp_for_${tableName}
        AFTER INSERT ON ${tableName}
        BEGIN
            UPDATE ${tableName} SET created_at = datetime('now', '+8 hours') WHERE rowid = new.rowid;
        END;
        `;
};

const updateAtTimestampTrigger = (tableName: string) => {
    return `
        CREATE TRIGGER set_updated_at_timestamp_for_${tableName}
        AFTER UPDATE ON ${tableName}
        BEGIN
            UPDATE ${tableName} SET updated_at = datetime('now', '+8 hours') WHERE rowid = new.rowid;
        END;
        `;
};

export { createAtTimestampTrigger, updateAtTimestampTrigger };
