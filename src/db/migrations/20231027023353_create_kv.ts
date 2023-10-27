import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('dp_kv', (table) => {
        table.increments('id').primary();
        table.string('key').notNullable();
        table.string('value').nullable();
        // create_at and update_at
        table.timestamps(true, true);
        table.unique(['key']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('dp_kv');
}
