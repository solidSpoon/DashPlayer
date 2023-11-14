import { Parser } from 'node-sql-parser';
import { p } from './Util';

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
const parseQuery = (
    where: string,
    orderBy: string
): {
    whereSql: string;
    orderBySql: string;
} => {
    const sql = `SELECT * FROM t WHERE ${where} ORDER BY ${orderBy}`;
    const parser = new Parser();
    const ast = parser.astify(sql);
    proceedColumns(ast);
    console.log(ast);
    console.log(parser.sqlify(ast));
    const res = {
        whereSql: '',
        orderBySql: '',
    };
    if ('where' in ast) {
        res.whereSql = parser.exprToSQL(ast.where);
    }
    if ('orderby' in ast) {
        console.log('obbb', ast.orderby, parser.exprToSQL(ast.orderby));
        res.orderBySql = parser.exprToSQL(ast.orderby);
    }
    console.log(res);
    return res;
};

// eslint-disable-next-line import/prefer-default-export
export { parseQuery };
