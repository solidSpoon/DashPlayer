import Knex from 'knex';

import { attachPaginate } from 'knex-paginate';
import knexConfig from '../knexfile';

attachPaginate();
const knex = Knex(knexConfig);
export { knex as knexDb };

// export const knex = require('knex')(require('../knexfile'))
