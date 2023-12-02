import { createAtTimestampTrigger, toTrimLowerCaseTrigger, updateAtTimestampTrigger } from './util/util.js';

const WATCH_PROJECT_VIDEO_TABLE_NAME = 'dp_watch_project_video';
export async function up(knex) {
    return knex.schema
        .createTable(WATCH_PROJECT_VIDEO_TABLE_NAME, (table) => {
            table.increments('id').primary();
            table.integer('project_id').notNullable();
            table.string('video_name').notNullable();
            table.string('video_path', 1024).notNullable();
            table.boolean('current_playing').notNullable().defaultTo(false);
            table.string('subtitle_path').notNullable();
            table.integer('current_time').notNullable().defaultTo(0);
            table.integer('duration').notNullable().defaultTo(0);
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['project_id', 'video_path']);
        })
        .then(() => {
            return knex.raw(createAtTimestampTrigger(WATCH_PROJECT_VIDEO_TABLE_NAME));
        })
        .then(() => {
            return knex.raw(updateAtTimestampTrigger(WATCH_PROJECT_VIDEO_TABLE_NAME));
        });
}


export async function down(knex) {
    return knex.schema.dropTable(WATCH_PROJECT_VIDEO_TABLE_NAME);
}

