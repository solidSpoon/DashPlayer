import { Knex } from 'knex';

// eslint-disable-next-line import/prefer-default-export
export async function seed(knex: Knex): Promise<void> {
    // 如果 dp_ky 表中 'init_word_level' 的值为 'true'，则不执行 seed
    const rows = await knex('dp_kv').where({ key: 'init_word_level' });
    if (rows.length && rows[0].value === 'true') {
        return;
    }

    // Deletes ALL existing entries
    await knex('dp_word_level').del();

    console.log('seed init_word_level');
    // Inserts seed entries
    await knex('dp_word_level').insert([
        { word: 'hello', level: 1 },
        { word: 'world', level: 2 },
    ]);

    // 更新或者插入 dp_kv 表中 'init_word_level' 的值为 'true'
    await knex('dp_kv')
        .insert({
            key: 'init_word_level',
            value: 'true',
        })
        .catch(async () => {
            await knex('dp_kv').where({ key: 'init_word_level' }).update({
                value: 'true',
            });
        });
}
