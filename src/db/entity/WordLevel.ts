// table.increments('id').primary();
// table.string('word').notNullable();
// table.integer('level').notNullable();
// table.integer('translate').nullable();
// // create_at and update_at
// table.timestamps(true, false);
// table.unique(['word']);

interface WordLevel {
    id?: number;
    word?: string;
    level?: number;
    translate?: number;
    created_at?: string;
    updated_at?: string;
}
