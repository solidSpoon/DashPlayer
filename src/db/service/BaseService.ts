import Knex from 'knex';

import knexConfig from '../knexfile';

const knex = Knex(knexConfig);

export { knex as knexDb };

// export const knex = require('knex')(require('../knexfile'));
const createAtTimestampTrigger = (tableName: string) => {
    return `
        CREATE TRIGGER set_created_at_timestamp_for_${tableName}
        AFTER INSERT ON ${tableName}
        BEGIN
            UPDATE ${tableName} SET created_at = datetime('now', '+8 hours') WHERE rowid = new.rowid;
        END;
        `;
};
export { createAtTimestampTrigger };
const updateAtTimestampTrigger = (tableName: string) => {
    return `
        CREATE TRIGGER set_updated_at_timestamp_for_${tableName}
        AFTER UPDATE ON ${tableName}
        BEGIN
            UPDATE ${tableName} SET updated_at = datetime('now', '+8 hours') WHERE rowid = new.rowid;
        END;
        `;
};
export { updateAtTimestampTrigger };
