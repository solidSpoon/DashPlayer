#!/usr/bin/env node
/**
 * 构建预置词典数据 resources/dictionary.sqlite。
 *
 * 数据源：ECDICT 1.0.28（https://github.com/skywind3000/ECDICT，MIT License）。
 * 流程：下载源库（带 sha256 校验与临时目录缓存）→ 解压 → 过滤常用词 → 写入精简 SQLite → 输出统计。
 *
 * 用法：yarn build:dictionary
 *
 * 说明：
 * - 过滤策略：BNC 或 COCA 词频排名 <= 30000，或 Collins/Oxford 收录，或带考试标签；
 *   实测约 3.8 万词条、5MB 左右，覆盖日常查词的绝大多数场景。
 * - 考试标签只保留 zk/gk/cet4/cet6/ky/toefl/ielts/gre（与前端 i18n 映射一致）。
 * - 产物需要提交到仓库；表结构契约见
 *   src/backend/infrastructure/translate/builtinDictionarySchema.ts（DDL 与 schema_version 必须一致）。
 * - node:sqlite 在 node 22.x 需要 --experimental-sqlite，缺 flag 时脚本会以该 flag 自重启。
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// node:sqlite 在 node 22.x 位于实验 flag 之后，缺 flag 时以子进程自重启，
// 避免要求调用方记住特殊命令；它不在 eslint import 插件的内置模块清单里，故行级豁免解析检查。
let DatabaseSync;
try {
    // eslint-disable-next-line import/no-unresolved
    ({ DatabaseSync } = await import('node:sqlite'));
} catch {
    console.info('当前 Node 需要 --experimental-sqlite，正在以该 flag 重启脚本...');
    const rerun = spawnSync(process.execPath, ['--experimental-sqlite', ...process.argv.slice(1)], {
        stdio: 'inherit',
    });
    process.exit(rerun.status ?? 1);
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(REPO_ROOT, 'resources', 'dictionary.sqlite');

/** ECDICT 1.0.28 的 sqlite 源库；内容固定，因此可以 pin 住 sha256。 */
const ECDICT_SOURCE = {
    url: 'https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip',
    sha256: 'ea01f76a3b3351021ce47077e89234465cc9441c8793054495320d06c0c3f3f6',
};

/**
 * 与 builtinDictionarySchema.ts 契约保持一致（该文件是 TS，独立脚本无法 import，改这里时两边都要改）。
 */
const SCHEMA_VERSION = 1;
const SCHEMA_SQL = `
CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE entries (
    word_key TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    phonetic TEXT NOT NULL DEFAULT '',
    translation TEXT NOT NULL DEFAULT '',
    collins INTEGER NOT NULL DEFAULT 0,
    oxford INTEGER NOT NULL DEFAULT 0,
    bnc INTEGER NOT NULL DEFAULT 0,
    frq INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '',
    exchange TEXT NOT NULL DEFAULT ''
);
`;

/** 只保留的考试标签；前端 i18n（common.json 的 dictTag* 键）按这份清单做映射。 */
const KNOWN_TAGS = ['zk', 'gk', 'cet4', 'cet6', 'ky', 'toefl', 'ielts', 'gre'];

/** 常用词的词频排名阈值（BNC 与 COCA 均适用）。 */
const FREQUENCY_LIMIT = 30000;

const hashFile = (filePath) =>
    new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        fs.createReadStream(filePath)
            .on('error', reject)
            .on('data', (chunk) => hash.update(chunk))
            .on('end', () => resolve(hash.digest('hex')));
    });

/**
 * 下载文件（跟随重定向），带简单的进度输出。
 * @param {string} url 下载地址。
 * @param {string} dest 本地目标路径。
 * @returns {Promise<void>}
 */
const download = (url, dest) =>
    new Promise((resolve, reject) => {
        const request = (target, redirects) => {
            if (redirects > 5) {
                reject(new Error(`重定向次数过多: ${url}`));
                return;
            }
            httpsGet(target, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    request(new URL(res.headers.location, target).toString(), redirects + 1);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`下载失败 ${res.statusCode}: ${target}`));
                    return;
                }
                const total = Number(res.headers['content-length'] || 0);
                let received = 0;
                let nextMilestone = 0;
                const out = fs.createWriteStream(dest);
                res.on('data', (chunk) => {
                    received += chunk.length;
                    if (received >= nextMilestone) {
                        nextMilestone += 20 * 1024 * 1024;
                        console.info(`  已下载 ${(received / 1048576).toFixed(0)}MB${total ? ` / ${(total / 1048576).toFixed(0)}MB` : ''}`);
                    }
                });
                res.pipe(out);
                out.on('finish', () => resolve());
                out.on('error', reject);
                res.on('error', reject);
            }, reject);
        };
        request(url, 0);
    });

/**
 * HTTPS GET 的最小封装，避免脚本依赖 axios（Node 原生 https 即可满足一次性下载）。
 * @param {string} url 请求地址。
 * @param {(res: import('node:http').IncomingMessage) => void} callback 响应回调。
 * @param {(error: Error) => void} onError 请求级错误回调（连接失败/重置等）；
 *   事件回调里不能直接 throw，否则错误会变成 uncaught exception，外层 Promise 永远不会 settle。
 */
const httpsGet = (url, callback, onError) => {
    import('node:https').then(({ default: https }) => {
        https.get(url, { headers: { 'User-Agent': 'DashPlayer-dictionary-build' } }, callback)
            .on('error', onError);
    });
};
/**
 * 解压 zip：unix 用 unzip，Windows 用 PowerShell Expand-Archive（与 scripts/download.mjs 的策略一致）。
 * @param {string} zipPath zip 文件路径。
 * @param {string} destDir 解压目标目录。
 */
const extractZip = (zipPath, destDir) => {
    fs.mkdirSync(destDir, { recursive: true });
    if (process.platform === 'win32') {
        execFileSync('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
            `Expand-Archive -Force -LiteralPath "${zipPath}" -DestinationPath "${destDir}"`,
        ], { stdio: 'inherit' });
        return;
    }
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'inherit' });
};

/**
 * 归一化考试标签：只保留白名单内的单值，去重后按固定顺序输出。
 * @param {string | null} tag ECDICT 的 tag 原文（空格分隔）。
 * @returns {string} 归一化后的空格分隔标签串。
 */
const normalizeTags = (tag) => {
    const values = new Set((tag ?? '').split(/\s+/u).filter((value) => KNOWN_TAGS.includes(value)));
    return KNOWN_TAGS.filter((value) => values.has(value)).join(' ');
};

console.info('== 1/4 准备 ECDICT 源数据 ==');
const cacheDir = path.join(os.tmpdir(), 'dashplayer-dictionary-build');
fs.mkdirSync(cacheDir, { recursive: true });
const zipPath = path.join(cacheDir, path.basename(ECDICT_SOURCE.url));
if (fs.existsSync(zipPath) && (await hashFile(zipPath)) === ECDICT_SOURCE.sha256) {
    console.info(`复用缓存: ${zipPath}`);
} else {
    console.info(`下载 ${ECDICT_SOURCE.url}`);
    await download(ECDICT_SOURCE.url, zipPath);
    const actualSha256 = await hashFile(zipPath);
    if (actualSha256 !== ECDICT_SOURCE.sha256) {
        fs.rmSync(zipPath);
        throw new Error(`ECDICT 源文件 sha256 不匹配: 期望 ${ECDICT_SOURCE.sha256}, 实际 ${actualSha256}`);
    }
    console.info('sha256 校验通过');
}

console.info('== 2/4 解压源库 ==');
const extractDir = path.join(cacheDir, 'extract');
if (fs.existsSync(path.join(extractDir, 'stardict.db'))) {
    console.info('复用已解压的 stardict.db');
} else {
    extractZip(zipPath, extractDir);
}
const sourceDbPath = path.join(extractDir, 'stardict.db');
if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`解压后未找到 stardict.db: ${extractDir}`);
}

console.info('== 3/4 过滤常用词并写入 dictionary.sqlite ==');
const sourceDb = new DatabaseSync(sourceDbPath, { readOnly: true });
const filterSql = `
  (bnc IS NOT NULL AND bnc BETWEEN 1 AND ${FREQUENCY_LIMIT})
  OR (frq IS NOT NULL AND frq BETWEEN 1 AND ${FREQUENCY_LIMIT})
  OR collins >= 1
  OR oxford >= 1
  OR (tag IS NOT NULL AND TRIM(tag) != '')
`;
const rows = sourceDb.prepare(`
    SELECT word, phonetic, translation, collins, oxford, tag, bnc, frq, exchange
    FROM stardict
    WHERE ${filterSql}
    ORDER BY word COLLATE NOCASE
`).all();
console.info(`源库命中 ${rows.length} 条词条`);

fs.rmSync(OUTPUT_PATH, { force: true });
const targetDb = new DatabaseSync(OUTPUT_PATH);
targetDb.exec(SCHEMA_SQL);

const insertStmt = targetDb.prepare(`
    INSERT INTO entries (word_key, word, phonetic, translation, collins, oxford, bnc, frq, tags, exchange)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const metaStmt = targetDb.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');

targetDb.exec('BEGIN');
let insertedCount = 0;
for (const row of rows) {
    const word = String(row.word ?? '').trim();
    if (!word) continue;
    const wordKey = word.toLowerCase();
    const translation = String(row.translation ?? '');
    if (!translation.trim()) continue;

    insertStmt.run(
        wordKey,
        word,
        String(row.phonetic ?? ''),
        translation,
        Number(row.collins ?? 0),
        Number(row.oxford ?? 0),
        Number(row.bnc ?? 0),
        Number(row.frq ?? 0),
        normalizeTags(row.tag),
        String(row.exchange ?? ''),
    );
    insertedCount += 1;
}
const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
for (const [key, value] of [
    ['schema_version', String(SCHEMA_VERSION)],
    ['source', 'ecdict'],
    ['source_version', '1.0.28'],
    ['word_count', String(insertedCount)],
    ['generated_at', generatedAt],
]) {
    metaStmt.run(key, value);
}
targetDb.exec('COMMIT');
targetDb.close();
sourceDb.close();

console.info('== 4/4 完成 ==');
const { size } = fs.statSync(OUTPUT_PATH);
console.info(`产物: ${OUTPUT_PATH}`);
console.info(`词条数: ${insertedCount}`);
console.info(`文件大小: ${(size / 1048576).toFixed(1)}MB`);
