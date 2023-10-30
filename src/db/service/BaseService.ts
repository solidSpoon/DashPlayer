import Knex from 'knex';

import knexConfig from '../knexfile';

const knex = Knex(knexConfig);

export { knex as knexDb };

// export const knex = require('knex')(require('../knexfile'))
