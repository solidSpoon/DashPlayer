// eslint-disable-next-line import/prefer-default-export
import baseWords from './data/baseWord.js';

export async function seed(knex) {
    // 如果 dp_ky 表中 'init_word_level' 的值为 'true'，则不执行 seed
    const rows = await knex('dp_kv').where({ key: 'init_stem_level' });
    if (rows.length && rows[0].value === 'true') {
        return;
    }

    // Deletes ALL existing entries
    await knex('dp_stem_level').del();

    console.log('seed init_stem_level');

    try {
        // Inserts seed entries
        baseWords.forEach(async (w) => {
            await knex('dp_stem_level').insert(w).onConflict('stem').merge();
        });
    } catch (e) {
        console.log(e);
    }

    // 更新或者插入 dp_kv 表中 'init_word_level' 的值为 'true'
    await knex('dp_kv')
        .insert({
            key: 'init_stem_level',
            value: 'true',
        })
        .onConflict('key')
        .merge();
}
