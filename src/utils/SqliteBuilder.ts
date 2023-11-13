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
const build = (where: string, orderBy: string) => {
    const sql = `SELECT * FROM t WHERE ${where} ORDER BY ${orderBy}`;
    const parser = new Parser();
    const ast = parser.astify(sql);
    proceedColumns(ast);
    console.log(ast);
    console.log(parser.sqlify(ast));
};

// eslint-disable-next-line import/prefer-default-export
export { build };
