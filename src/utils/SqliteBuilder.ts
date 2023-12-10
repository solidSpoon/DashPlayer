import { Parser } from 'node-sql-parser';
import { p, strBlank } from './Util';

// const parser = new Parser();
// const ast = parser.astify('SELECT * FROM t'); // mysql sql grammer parsed by default
//
// console.log(ast);

const columMapping = new Map<string, string>([
    ['id', 'id'],
    ['word', 'word'],
    ['level', 'level'],
    ['translation', 'translation'],
    ['note', 'note'],
]);

function proceedColumns(ast: any) {
    if (!ast) return;
    Object.keys(ast).forEach((key) => {
        if (key === 'type') {
            if (ast[key] === 'column_ref') {
                const k = p(ast.column);
                ast.column = columMapping.get(k) ?? k;
            }
        } else if (typeof ast[key] === 'object') {
            proceedColumns(ast[key]);
        }
    });
}

const processWhere = (sql: string): string => {
    if (strBlank(sql)) return '';
    const baseSql = 'SELECT * FROM `t` WHERE ';
    const parser = new Parser();
    const ast = parser.astify(baseSql + sql);
    proceedColumns(ast);
    const finalSql = parser.sqlify(ast);
    return finalSql.substring(baseSql.length);
};

const processOrderBy = (sql: string): string => {
    if (strBlank(sql)) return '';
    const baseSql = 'SELECT * FROM `t` ORDER BY ';
    const parser = new Parser();
    const ast = parser.astify(baseSql + sql);
    proceedColumns(ast);
    const finalSql = parser.sqlify(ast);
    return finalSql.substring(baseSql.length);
};
const parseQuery = (
    where: string,
    orderBy: string
): {
    whereSql: string;
    orderBySql: string;
} => {
    const res = {
        whereSql: processWhere(where),
        orderBySql: processOrderBy(orderBy),
    };
    console.log('parseQuery', res);
    return res;
};
// eslint-disable-next-line import/prefer-default-export
export { parseQuery };
