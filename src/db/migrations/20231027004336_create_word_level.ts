import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('dp_word_level', (table) => {
        table.increments('id').primary();
        table.string('word').notNullable();
        table.integer('level').notNullable();
        table.integer('translate').nullable();
        // create_at and update_at
        table.timestamps(true, true);
        table.unique(['word']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('dp_word_level');
}
