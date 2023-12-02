import { createAtTimestampTrigger, toTrimLowerCaseTrigger, updateAtTimestampTrigger } from './util/util.js';

const WATCH_PROJECT_TABLE_NAME = 'dp_watch_project';
export async function up(knex) {
    return knex.schema
        .createTable(WATCH_PROJECT_TABLE_NAME, (table) => {
            table.increments('id').primary();
            table.string('project_name').notNullable();
            table.integer('type').notNullable().defaultTo(0);
            table.string('project_key').notNullable();
            table.string('project_path', 1024).notNullable();
            table.integer('current_video_id').notNullable().defaultTo(0);
            //watch time
            table.integer('last_watch_time').notNullable().defaultTo(0);
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['project_key']);
        })
        .then(() => {
            return knex.raw(createAtTimestampTrigger(WATCH_PROJECT_TABLE_NAME));
        })
        .then(() => {
            return knex.raw(updateAtTimestampTrigger(WATCH_PROJECT_TABLE_NAME));
        });
}


export async function down(knex) {
    return knex.schema.dropTable(WATCH_PROJECT_TABLE_NAME);
}

