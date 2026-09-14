/**
 * 校验用例文档与 e2e 用例是否对得上。
 *
 * 约定见 docs/test-cases/README.md：一个设置页一份文档，文档里逐条写场景，
 * 每条场景挂一个稳定 ID；同一个 ID 必须出现在该页 spec 的 test() 标题里。
 * 只改一边就会让这个脚本报错，避免文档烂掉。
 *
 * 文档里每条场景只有两种写法，脚本按行首认：
 * - 自动化：`- 用例：**[SET-PRX-01]** 场景描述`
 * - 缺口：  `- 编号：**[SET-PRX-03]**（未覆盖）理由`
 *
 * 两类错误：
 * - 未翻译：文档标了「自动化」，但该页 spec 里找不到这个 ID。
 * - 未登记：spec 里出现了 ID，但文档没把它登记成「自动化」。
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** 仓库根目录（本文件在 scripts/ 下）。 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 用例文档目录；README.md 只讲规范，不参与比对。 */
const CASES_DIR = path.join(REPO_ROOT, 'docs', 'test-cases');
/** e2e 用例目录。 */
const E2E_DIR = path.join(REPO_ROOT, 'e2e');

/**
 * ID 形态：SET-<页面或范围>-<序号>。
 * 中段长度不固定（AUTO 四个字母、SVC 三个），所以给的是区间而不是定长。
 */
const ID_SOURCE = 'SET-[A-Z]{2,6}-\\d{2}';
const BOLD_ID_RE = new RegExp(`\\*\\*\\[(${ID_SOURCE})\\]\\*\\*`, 'g');
const SPEC_ID_RE = new RegExp(`\\[(${ID_SOURCE})\\]`, 'g');
/** 页面文档顶部声明用例文件的那一行。 */
const SPEC_FILE_RE = /用例文件：`([^`]+)`/;
/** 缺口状态写在 ID 后面的括号里。 */
const GAP_STATUS_RE = /（(未覆盖|手动)）/;
/** 自动化用例的行首。 */
const CASE_LINE_RE = /^\s*-\s*用例：/;

/** 列出目录下指定后缀的文件。 */
const listFiles = (dir, ext) =>
    fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(ext))
        .map((name) => path.join(dir, name));

/**
 * 解析一份页面文档。
 *
 * @param {string} file 文档绝对路径。
 * @returns {{page: object, problems: string[]}} page 为 {file, specFile, cases}；problems 为文档自身的问题。
 */
const parsePageDoc = (file) => {
    const relFile = path.relative(REPO_ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const problems = [];
    const cases = [];

    const specFile = lines.map((line) => line.match(SPEC_FILE_RE)).find(Boolean)?.[1];
    if (!specFile) {
        problems.push(`${relFile} 顶部没有声明「用例文件：\`e2e/xxx.spec.ts\`」，脚本不知道该去哪找用例`);
    }

    lines.forEach((line, index) => {
        const ids = [...line.matchAll(BOLD_ID_RE)].map((match) => match[1]);
        if (ids.length === 0) {
            return;
        }
        const gapStatus = line.match(GAP_STATUS_RE)?.[1];
        let status;
        if (gapStatus) {
            status = gapStatus;
        } else if (CASE_LINE_RE.test(line)) {
            status = '自动化';
        } else {
            problems.push(
                `${relFile}:${index + 1} 这行的 ID 没说清状态：自动化要写成「- 用例：」，缺口要在 ID 后标「（未覆盖）」或「（手动）」`
            );
            return;
        }
        for (const id of ids) {
            cases.push({id, status, file: relFile, line: index + 1});
        }
    });

    // 同一份文档里的 ID 应当属于同一个页面/范围前缀，避免把别的页的用例抄错地方
    const prefixes = new Set(cases.map((item) => item.id.split('-')[1]));
    if (prefixes.size > 1) {
        problems.push(`${relFile} 里混了多个 ID 前缀（${[...prefixes].join('、')}），一页里的前缀应当一致`);
    }

    return {page: {file: relFile, specFile, cases}, problems};
};

/**
 * 扫描 spec 里 test() 标题上的 ID。
 *
 * 只在含 `test(` 的行上取 ID，避免把注释或说明文字里的 ID 当成用例。
 */
const scanSpecs = () => {
    const hits = [];
    const problems = [];

    for (const file of listFiles(E2E_DIR, '.ts')) {
        const relFile = path.relative(REPO_ROOT, file);
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
            if (!line.includes('test(')) {
                return;
            }
            for (const match of line.matchAll(SPEC_ID_RE)) {
                hits.push({id: match[1], file: relFile, line: index + 1});
            }
        });
    }

    const seen = new Map();
    for (const hit of hits) {
        const first = seen.get(hit.id);
        if (first) {
            problems.push(
                `同一 ID 在 spec 里出现多次：${hit.id}（${first.file}:${first.line} 与 ${hit.file}:${hit.line}）`
            );
        } else {
            seen.set(hit.id, hit);
        }
    }

    return {hits, problems};
};

const main = () => {
    const problems = [];
    const pages = [];

    for (const file of listFiles(CASES_DIR, '.md')) {
        if (path.basename(file) === 'README.md') {
            continue;
        }
        const {page, problems: docProblems} = parsePageDoc(file);
        problems.push(...docProblems);
        pages.push(page);
    }

    const allCases = pages.flatMap((page) => page.cases);
    const caseById = new Map();
    for (const item of allCases) {
        const first = caseById.get(item.id);
        if (first) {
            problems.push(`文档里重复登记：${item.id}（${first.file}:${first.line} 与 ${item.file}:${item.line}）`);
        } else {
            caseById.set(item.id, item);
        }
    }

    const {hits, problems: specProblems} = scanSpecs();
    problems.push(...specProblems);
    const specById = new Map(hits.map((hit) => [hit.id, hit]));

    // 未翻译：文档说是自动化，该页 spec 里却没有这个 ID
    for (const page of pages) {
        for (const item of page.cases) {
            if (item.status !== '自动化') {
                continue;
            }
            if (!page.specFile) {
                continue;
            }
            const hit = specById.get(item.id);
            if (!hit) {
                problems.push(
                    `未翻译：${item.id} 在 ${item.file}:${item.line} 标了「自动化」，但 ${page.specFile} 里找不到这个 ID`
                );
                continue;
            }
            if (hit.file !== page.specFile) {
                problems.push(
                    `未翻译：${item.id} 登记在 ${item.file}（对应 ${page.specFile}），实际写在 ${hit.file}:${hit.line}`
                );
            }
        }
    }

    // 未登记：spec 里有的 ID 必须是文档里的「自动化」行
    for (const hit of hits) {
        const item = caseById.get(hit.id);
        if (!item) {
            problems.push(`未登记：${hit.file}:${hit.line} 用了 ${hit.id}，但用例文档里没有这条`);
            continue;
        }
        if (item.status !== '自动化') {
            problems.push(
                `未登记：${hit.id} 已写成用例（${hit.file}:${hit.line}），但文档里把它标成了「${item.status}」（${item.file}:${item.line}）`
            );
        }
    }

    // 各页概览直接由脚本输出，不手写进文档（手写的概览迟早与清单对不上）
    const overview = pages.map((page) => {
        const automated = page.cases.filter((item) => item.status === '自动化').length;
        const gaps = page.cases.filter((item) => item.status !== '自动化');
        const gapText = gaps.length === 0 ? '无缺口' : `缺口 ${gaps.length} 条（${gaps.map((item) => item.id).join('、')}）`;
        return `  ${path.basename(page.file, '.md').padEnd(18)} 自动化 ${String(automated).padStart(2)} 条，${gapText}`;
    });

    if (problems.length > 0) {
        console.error('用例文档与 e2e 用例对不上：');
        for (const problem of problems) {
            console.error(`  - ${problem}`);
        }
        console.error('\n规范见 docs/test-cases/README.md。');
        process.exit(1);
    }

    console.log('用例文档校验通过，各页概览：');
    console.log(overview.join('\n'));
};

main();
