#!/usr/bin/env zx

import axios from 'axios';
import fs from 'fs';
import progress from "progress";
import {createHash} from "crypto";
import os from "os";
import path from 'path';
import {pipeline} from 'stream/promises';
import * as tarFs from 'tar-fs';
import unbzip2Stream from 'unbzip2-stream';
import chalk from 'chalk';
import { $ } from 'zx';
import { withNetworkRetry } from './network-retry.mjs';

const getGithubToken = () => process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const getGithubAuthHeaders = (url) => {
    const token = getGithubToken();
    if (!token) return {};
    if (!/github\.com|api\.github\.com/i.test(url)) return {};
    return {Authorization: `Bearer ${token}`};
};

/**
 * Calculate the hash of the file
 * @param path {string}
 * @param options {{algo: string}}
 * @returns {Promise<unknown>}
 */
function hashFile(path, options) {
    const algo = options.algo || "sha1";
    return new Promise((resolve, reject) => {
        const hash = createHash(algo);
        const stream = fs.createReadStream(path);
        stream.on("error", reject);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
    });
}

/////////////////////

const mkdirp = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
};

const extractZip = async (zipPath, destDir) => {
    mkdirp(destDir);
    if (process.platform === 'win32') {
        if (!zipPath || !destDir) {
            throw new Error(`Invalid archive arguments: zipPath="${zipPath}", destDir="${destDir}"`);
        }
        // NOTE: `pwsh -Command <string>` consumes the remainder of the command line, so extra args are not reliably
        // available in `$args` on CI shells. Use `-File` to pass zip/dest as proper script arguments.
        const psTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-ps-'));
        const psFile = path.join(psTmpDir, 'expand-archive.ps1');
        fs.writeFileSync(
            psFile,
            [
                'param(',
                '    [Parameter(Mandatory = $true)][string]$Zip,',
                '    [Parameter(Mandatory = $true)][string]$Dest',
                ')',
                'Expand-Archive -Force -LiteralPath $Zip -DestinationPath $Dest',
                '',
            ].join('\n')
        );
        // Avoid `\e` escape sequences when zx renders arguments through a bash-like layer on Windows.
        const psFileArg = String(psFile).replaceAll('\\', '/');
        const zipArg = String(zipPath).replaceAll('\\', '/');
        const destArg = String(destDir).replaceAll('\\', '/');
        try {
            await $`pwsh -NoProfile -ExecutionPolicy Bypass -File ${psFileArg} ${zipArg} ${destArg}`;
        } catch {
            await $`powershell -NoProfile -ExecutionPolicy Bypass -File ${psFileArg} ${zipArg} ${destArg}`;
        } finally {
            try {
                fs.rmSync(psTmpDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }
        return;
    }
    await $`unzip -o ${zipPath} -d ${destDir}`;
};

const extractTarGz = async (tarPath, destDir) => {
    mkdirp(destDir);
    await $`tar -xzf ${tarPath} -C ${destDir}`;
};

/**
 * 根据归档格式解压到指定目录，tar.bz2 在 Node 内流式处理以兼容 Windows。
 * @param {string} archivePath 归档文件路径。
 * @param {string} destDir 解压目标目录。
 * @returns {Promise<void>}
 */
const extractArchive = async (archivePath, destDir) => {
    if (archivePath.endsWith('.zip')) return extractZip(archivePath, destDir);
    if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) return extractTarGz(archivePath, destDir);
    if (archivePath.endsWith('.tar.bz2')) {
        mkdirp(destDir);
        await pipeline(
            fs.createReadStream(archivePath),
            unbzip2Stream(),
            tarFs.extract(destDir),
        );
        return;
    }
    throw new Error(`Unsupported archive type: ${archivePath}`);
};

const findFirstFile = (dir, predicate, maxDepth = 6, depth = 0) => {
    if (depth > maxDepth) return null;
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    for (const ent of entries) {
        const p = path.join(dir, ent.name);
        if (ent.isFile() && predicate(p)) return p;
    }
    for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const p = path.join(dir, ent.name);
        const found = findFirstFile(p, predicate, maxDepth, depth + 1);
        if (found) return found;
    }
    return null;
};

const downloadAndExtractBinaryFromZip = async ({url, outputPath, binaryNameCandidates}) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-download-'));
    const archivePath = path.join(tmpRoot, 'asset.zip');
    await download({url, dir: tmpRoot, file: 'asset.zip'});

    const extractDir = path.join(tmpRoot, 'extract');
    await extractZip(archivePath, extractDir);

    const found = findFirstFile(
        extractDir,
        (p) => binaryNameCandidates.includes(path.basename(p)),
        10
    );
    if (!found) {
        throw new Error(`Cannot find binary in archive from ${url}`);
    }

    fs.copyFileSync(found, outputPath);
    fs.chmodSync(outputPath, 0o755);
};

const getLatestReleaseAssetUrl = async ({owner, repo, nameRegex}) => {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const res = await withNetworkRetry(() => axios.get(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'DashPlayer-downloader',
            ...getGithubAuthHeaders(apiUrl),
        }
    }), {label: `查询 ${owner}/${repo} 最新发布`});
    const assets = res.data?.assets ?? [];
    const match = assets.find((a) => nameRegex.test(a?.name || ''));
    return match?.browser_download_url || null;
};

const getLatestReleaseAssetUrlIncludingPrerelease = async ({owner, repo, nameRegex}) => {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;
    const res = await withNetworkRetry(() => axios.get(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'DashPlayer-downloader',
            ...getGithubAuthHeaders(apiUrl),
        }
    }), {label: `查询 ${owner}/${repo} 发布列表`});
    const releases = res.data ?? [];
    for (const release of releases) {
        const assets = release?.assets ?? [];
        const match = assets.find((a) => nameRegex.test(a?.name || ''));
        if (match?.browser_download_url) return match.browser_download_url;
    }
    return null;
};

/**
 * 把归档里的运行时二进制安装到目标路径（下载得到的归档与本地已有归档共用）。
 *
 * @param {{ archivePath: string, outputPath: string, binaryNameCandidates: string[], extraCopyPatterns?: RegExp[] }} param
 *   archivePath 归档文件路径（.tar.gz / .zip / .tar.bz2）；outputPath 二进制目标路径；
 *   binaryNameCandidates 归档里可接受的二进制文件名；extraCopyPatterns 需要一并拷到目标目录的附加文件。
 * @returns {Promise<void>}
 */
const installBinaryFromArchive = async ({archivePath, outputPath, binaryNameCandidates, extraCopyPatterns = []}) => {
    const tmpRoot = path.dirname(archivePath);
    const extractDir = path.join(tmpRoot, `extract-${path.basename(archivePath)}`);
    await extractArchive(archivePath, extractDir);

    const found = findFirstFile(
        extractDir,
        (p) => binaryNameCandidates.includes(path.basename(p)),
        12
    );
    if (!found) {
        throw new Error(`Cannot find binary in archive ${archivePath}`);
    }

    mkdirp(path.dirname(outputPath));
    fs.copyFileSync(found, outputPath);
    fs.chmodSync(outputPath, 0o755);
    console.info(chalk.green(`✅ runtime binary: ${found} -> ${outputPath}`));

    if (extraCopyPatterns.length > 0) {
        for (const pattern of extraCopyPatterns) {
            const matches = [];
            const collect = (dir, maxDepth = 10, depth = 0) => {
                if (depth > maxDepth) return;
                const entries = fs.readdirSync(dir, {withFileTypes: true});
                for (const ent of entries) {
                    const p = path.join(dir, ent.name);
                    if ((ent.isFile() || ent.isSymbolicLink()) && pattern.test(ent.name)) {
                        matches.push(p);
                    }
                }
                for (const ent of entries) {
                    if (!ent.isDirectory()) continue;
                    collect(path.join(dir, ent.name), maxDepth, depth + 1);
                }
            };
            collect(extractDir);
            for (const src of matches) {
                const dest = path.join(path.dirname(outputPath), path.basename(src));
                fs.copyFileSync(src, dest);
                fs.chmodSync(dest, 0o755);
                console.info(chalk.green(`✅ runtime extra: ${src} -> ${dest}`));
            }
        }
    }
};

/**
 * 从 URL 下载归档并安装运行时二进制。
 *
 * @param {{ url: string, outputPath: string, binaryNameCandidates: string[], extraCopyPatterns?: RegExp[] }} param
 *   url 归档地址；其余参数同 installBinaryFromArchive。
 * @returns {Promise<void>}
 */
const downloadAndExtractBinaryFromArchive = async ({
    url,
    outputPath,
    binaryNameCandidates,
    extraCopyPatterns = [],
}) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-download-'));
    const nameFromUrl = String(url).split('/').pop() || 'asset';
    const archivePath = path.join(tmpRoot, nameFromUrl);
    console.info(chalk.blue(`=> runtime archive: ${url}`));
    await download({url, dir: tmpRoot, file: nameFromUrl});
    await installBinaryFromArchive({archivePath, outputPath, binaryNameCandidates, extraCopyPatterns});
};

/**
 * 判断 llama.cpp 官方运行包是否已完整安装。
 * @param {string} runtimeDir 运行时目录。
 * @param {string} executableName 可执行文件名。
 * @param {string[]} dependencyPrefixes 平台依赖库文件名前缀清单。
 * @returns {boolean} 可执行文件和平台动态库均存在时返回 true。
 */
const isLlamaRuntimeReady = (runtimeDir, executableName, dependencyPrefixes) => {
    const entries = fs.existsSync(runtimeDir) ? fs.readdirSync(runtimeDir) : [];
    return fs.existsSync(path.join(runtimeDir, '.complete'))
        && fs.existsSync(path.join(runtimeDir, executableName))
        && dependencyPrefixes.every((prefix) => entries.some((entry) => entry.startsWith(prefix)));
};

const ffmpegUrls = {
    ffmpeg: {
        darwin: {
            arm64: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/snapshot/ffmpeg.zip',
            x64: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/snapshot/ffmpeg.zip',
        },
        linux: {
            arm64: 'https://ffmpeg.martin-riedl.de/redirect/latest/linux/arm64/snapshot/ffmpeg.zip',
            x64: 'https://ffmpeg.martin-riedl.de/redirect/latest/linux/amd64/snapshot/ffmpeg.zip',
        },
        win32: {
            x64: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
            arm64: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-winarm64-gpl.zip',
        }
    },
    ffprobe: {
        darwin: {
            arm64: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/snapshot/ffprobe.zip',
            x64: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/snapshot/ffprobe.zip',
        },
        linux: {
            arm64: 'https://ffmpeg.martin-riedl.de/redirect/latest/linux/arm64/snapshot/ffprobe.zip',
            x64: 'https://ffmpeg.martin-riedl.de/redirect/latest/linux/amd64/snapshot/ffprobe.zip',
        },
        win32: {
            x64: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
            arm64: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-winarm64-gpl.zip',
        }
    }
};

////////////////////
setProxy();
const dir = path.join(process.cwd(), 'lib');
// 当前源码版本号：whisper.cpp 运行时资产按发版 tag 发布，与该版本一一对应
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
mkdirp(dir);

const platform = process.env.npm_config_platform || os.platform()
const arch = process.env.npm_config_arch || os.arch()

/**
 * llama.cpp 官方包的动态库命名：unix 系带 lib 前缀，Windows 不带。
 * isLlamaRuntimeReady 与安装后校验共用同一份按平台计算的清单。
 */
const llamaDependencyPrefixesFor = (platform) => platform === 'win32'
    ? ['mtmd', 'llama-common', 'llama-server-impl']
    : ['libmtmd', 'libllama-common', 'libllama-server-impl'];

{
    // ffmpeg
    const file = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const res = await verifyExistence({
        dir,
        file,
    });
    if (res === 'need_download') {
        const downloadUrl = ffmpegUrls.ffmpeg?.[platform]?.[arch];
        if (!downloadUrl) {
            throw new Error(`Unsupported platform/arch for ffmpeg: ${platform}/${arch}`);
        }
        await downloadAndExtractBinaryFromZip({
            url: downloadUrl,
            outputPath: path.join(dir, file),
            binaryNameCandidates: platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg'],
        });
    }
}

{
    // ffprobe
    const file = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const res = await verifyExistence({
        dir,
        file,
    });
    if (res === 'need_download') {
        const downloadUrl = ffmpegUrls.ffprobe?.[platform]?.[arch];
        if (!downloadUrl) {
            throw new Error(`Unsupported platform/arch for ffprobe: ${platform}/${arch}`);
        }
        await downloadAndExtractBinaryFromZip({
            url: downloadUrl,
            outputPath: path.join(dir, file),
            binaryNameCandidates: platform === 'win32' ? ['ffprobe.exe'] : ['ffprobe'],
        });
    }
}

{
    // sherpa-onnx 离线识别 CLI
    const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
    const archDir = arch === 'arm64' ? 'arm64' : 'x64';
    const basePath = path.join(dir, 'sherpa-onnx', archDir, platformDir);
    mkdirp(basePath);

    const exeName = platform === 'win32' ? 'sherpa-onnx-offline.exe' : 'sherpa-onnx-offline';
    const exePath = path.join(basePath, exeName);
    const res = await verifyExistence({ dir: basePath, file: exeName });

    const version = '1.13.4';
    const releaseBase = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${version}`;
    const assetNames = {
        darwin: {
            arm64: `sherpa-onnx-v${version}-osx-arm64-static.tar.bz2`,
            x64: `sherpa-onnx-v${version}-osx-x64-static.tar.bz2`,
        },
        linux: {
            arm64: `sherpa-onnx-v${version}-linux-aarch64-static.tar.bz2`,
            x64: `sherpa-onnx-v${version}-linux-x64-static.tar.bz2`,
        },
        win32: {
            arm64: `sherpa-onnx-v${version}-win-arm64-static-MT-Release.tar.bz2`,
            x64: `sherpa-onnx-v${version}-win-x64-static-MT-Release.tar.bz2`,
        },
    };
    const assetName = assetNames[platform]?.[arch];
    const assetUrl = assetName ? `${releaseBase}/${assetName}` : null;
    if (!assetUrl) {
        throw new Error(`Unsupported sherpa-onnx platform/arch: ${platform}/${arch}`);
    }

    if (res === 'need_download') {
        console.info(chalk.blue(`=> sherpa-onnx target: ${exePath}`));
        await downloadAndExtractBinaryFromArchive({
            url: assetUrl,
            outputPath: exePath,
            binaryNameCandidates: [exeName],
        });
    }

    const ttsExeName = platform === 'win32' ? 'sherpa-onnx-offline-tts.exe' : 'sherpa-onnx-offline-tts';
    const ttsExePath = path.join(basePath, ttsExeName);
    const ttsRes = await verifyExistence({ dir: basePath, file: ttsExeName });
    if (ttsRes === 'need_download') {
        await downloadAndExtractBinaryFromArchive({
            url: assetUrl,
            outputPath: ttsExePath,
            binaryNameCandidates: [ttsExeName],
        });
    }
}

// llama.cpp 本地推理运行时：按平台下载官方二进制包。
// - macOS：Metal 包（arm64 走 GPU，Intel Mac 纯 CPU）
// - linux / win32-x64：Vulkan 包（核显/独显推理；llama.cpp 官方未提供 win-arm64 Vulkan 包）
// - win32-arm64：CPU 包
{
    const llamaVersion = 'b10819';
    const llamaDir = path.join(dir, 'llama', llamaVersion, `${platform}-${arch}`);
    mkdirp(llamaDir);
    const exeName = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    const assetNames = {
        darwin: { arm64: `llama-${llamaVersion}-bin-macos-arm64.tar.gz`, x64: `llama-${llamaVersion}-bin-macos-x64.tar.gz` },
        linux: { arm64: `llama-${llamaVersion}-bin-ubuntu-vulkan-arm64.tar.gz`, x64: `llama-${llamaVersion}-bin-ubuntu-vulkan-x64.tar.gz` },
        win32: { arm64: `llama-${llamaVersion}-bin-win-cpu-arm64.zip`, x64: `llama-${llamaVersion}-bin-win-vulkan-x64.zip` },
    };
    const assetName = assetNames[platform]?.[arch];
    if (!assetName) throw new Error(`本地推理不支持平台：${platform}/${arch}`);
    const dependencyPrefixes = llamaDependencyPrefixesFor(platform);
    // 可执行文件之外还需落地的运行包内容：unix 的动态库（含 .so.0 版本别名，
    // 动态链接器按 SONAME 查找）；Windows 的 DLL；macOS 另有 Metal 着色器。
    const extraCopyPatterns = platform === 'win32' ? [/\.dll$/] : [/\.dylib$/, /\.metal$/, /\.so(\.|$)/];
    const exePath = path.join(llamaDir, exeName);
    if (!isLlamaRuntimeReady(llamaDir, exeName, dependencyPrefixes)) {
        await downloadAndExtractBinaryFromArchive({
            url: `https://github.com/ggml-org/llama.cpp/releases/download/${llamaVersion}/${assetName}`,
            outputPath: exePath,
            binaryNameCandidates: [exeName],
            extraCopyPatterns,
        });
        if (!dependencyPrefixes.every((prefix) => fs.readdirSync(llamaDir).some((entry) => entry.startsWith(prefix)))) {
            throw new Error(`llama.cpp 运行时包不完整，缺少依赖库（${dependencyPrefixes.join(', ')}），请重试 yarn run download`);
        }
        // .complete 标记是“安装侧完成校验”的唯一凭据，LocalAiRuntime 只检查该标记，
        // 不在运行时侧复刻依赖库清单，避免两份清单漂移。
        fs.writeFileSync(path.join(llamaDir, '.complete'), `${llamaVersion}\n`);
    }
}

/**
 * 校验文件是否存在以及可选的 SHA1 摘要。
 * @param dir {string} 文件目录。
 * @param file {string} 文件名。
 * @param sha {string | undefined} 可选 SHA1 摘要。
 * @returns {Promise<'need_download' | 'pass'>} 是否需要下载。
 */
async function verifyExistence({
                                   dir,
                                   file,
                                   sha,
                               }) {
    try {
        if (fs.statSync(path.join(dir, file)).isFile()) {
            console.info(chalk.green(`✅ File ${file} already exists`));
            const hash = await hashFile(path.join(dir, file), {algo: "sha1"});
            if (sha === undefined || hash === sha) {
                console.info(chalk.green(`✅ File ${file} valid`));
                return 'pass';
            } else {
                console.error(
                    chalk.red(`❌ File ${file} not valid, start to redownload`)
                );
                fs.unlinkSync(path.join(dir, file));
                return 'need_download';
            }
        }
    } catch (err) {
        if (err && err.code !== "ENOENT") {
            console.error(chalk.red(`❌ Error: ${err}`));
            process.exit(1);
        } else {
            console.info(chalk.blue(`=> Start to download File ${file}`));
            return 'need_download';
        }
    }
}

/**
 * 将系统代理环境变量应用到下载客户端。
 */
function setProxy() {
    const proxyUrl =
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy;

    if (proxyUrl) {
        const {hostname, port, protocol} = new URL(proxyUrl);
        axios.defaults.proxy = {
            host: hostname,
            port: port,
            protocol: protocol,
        };
    }
}

/**
 * 单次下载尝试：流式写入目标文件，并按需校验 SHA1。
 * 失败时抛出错误，交给 withNetworkRetry 判断是否值得重试。
 *
 * @param {{url: string, dest: string, file: string, sha: string | undefined}} param
 *   url 下载地址；dest 目标文件路径；file 文件名（日志与校验用）；sha 可选 SHA1。
 * @returns {Promise<void>} 文件写入并通过校验后结束。
 */
async function fetchToFile({url, dest, file, sha}) {
    const response = await axios.get(url, {
        responseType: "stream",
        headers: getGithubAuthHeaders(url),
    });
    const totalLength = response.headers["content-length"];

    const progressBar = new progress(`-> downloading [:bar] :percent :etas`, {
        width: 40,
        complete: "=",
        incomplete: " ",
        renderThrottle: 1,
        total: parseInt(totalLength),
    });

    response.data.on("data", (chunk) => {
        progressBar.tick(chunk.length);
    });
    await new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(dest)).on("close", async () => {
            console.info(chalk.green(`✅ File ${file} downloaded successfully`));
            const hash = await hashFile(dest, {algo: "sha1"});
            if (sha === undefined || hash === sha) {
                resolve();
            } else {
                // 内容对不上：常见原因是下载被截断，带 HASH_MISMATCH 让上层重下一次
                reject(Object.assign(new Error(`File ${file} sha1 mismatch`), {code: 'HASH_MISMATCH'}));
            }
        });
    });
}

/**
 * 下载文件并校验可选的 SHA1 摘要。
 * 瞬时网络故障（DNS 抖动、连接重置、5xx、下载被截断）会退避重试，重试用尽才失败。
 *
 * @param url {string} 下载地址。
 * @param dir {string} 保存目录。
 * @param file {string} 保存文件名。
 * @param sha {string | undefined} 可选 SHA1 摘要。
 * @returns {Promise<void>} 下载完成后结束。
 */
async function download({url, dir, file, sha}) {
    const dest = path.join(dir, file);
    console.info(chalk.blue(`=> Start to download from ${url} to ${dest}`));
    try {
        await withNetworkRetry(() => fetchToFile({url, dest, file, sha}), {label: `download ${file}`});
        console.info(chalk.green(`✅ File ${file} valid`));
    } catch (err) {
        console.error(
            chalk.red(
                `❌ Failed to download ${url}: ${err}.\nPlease try again using command \`yarn download\``
            )
        );
        process.exit(1);
    }
}

/**
 * 运行时基于固定版本的 whisper.cpp 构建；parakeet-cli 输出格式是
 * 解析契约（见 WhisperCppCli.parseOutput），升级前需重新验证。
 */
const WHISPER_CPP_REF = '52a939a2a762224e255d366c1182b2af4dd1a032';

/**
 * 运行时配方版本：构建参数或“随包附带文件”一变就必须 +1。
 * 同一 ref 不同配方产出的二进制不可互换（r2 = Windows 静态 CRT + 关 OpenMP + 附带
 * vulkan-1.dll），标记里带上它，已装的旧配方运行时才会被重装而不是继续沿用。
 */
const WHISPER_RUNTIME_RECIPE = 'r2';

/**
 * Windows 侧 ggml-vulkan 对 vulkan-1.dll 是硬链接依赖（非 delay-load）：干净系统
 * （无独显驱动、未装 VC 运行库）的 system32 里没有它，缺了进程在加载期就死。
 * loader 取 LunarG 官方运行包（Apache-2.0/MIT，许可证随包附带），
 * 版本与 release.yml 的 VULKAN_VERSION 对齐。
 */
const VULKAN_RUNTIME_VERSION = '1.4.357.0';
const VULKAN_RUNTIME_COMPONENTS_URL = `https://sdk.lunarg.com/sdk/download/${VULKAN_RUNTIME_VERSION}/windows/vulkan-runtime-components.zip`;

/**
 * 运行时目录中的来源标记文件名：记录已安装的二进制来自哪个 Release 版本或哪个源码 ref。
 * 只判文件存在无法区分“装的是哪一份”，会让人在换 ref / 换版本后继续沿用旧二进制。
 */
const WHISPER_RUNTIME_MARKER = '.runtime-source';

/**
 * 读取运行时来源标记。
 * @param {string} markerPath 标记文件路径。
 * @returns {string | null} 标记内容；未安装过或标记缺失时为 null。
 */
const readWhisperRuntimeMarker = (markerPath) => {
    try {
        return fs.readFileSync(markerPath, 'utf8').trim();
    } catch {
        return null;
    }
};

/**
 * whisper.cpp 运行时资产名，与 release.yml 的 Package 步骤产出一一对应：
 * Windows 打包为 zip，其余平台 tar.gz。
 * @param {string} platform 目标平台（process.platform 取值）。
 * @param {string} arch 目标架构（x64 / arm64）。
 * @returns {string} 资产文件名。
 */
const whisperRuntimeAssetName = (platform, arch) =>
    `whisper-cpp-${platform}-${arch}.${platform === 'win32' ? 'zip' : 'tar.gz'}`;

/**
 * 下载 LunarG 官方 Vulkan 运行包，把 x64 的 vulkan-1.dll 与许可证安装到目标目录。
 *
 * Windows 上 parakeet-cli.exe 对 vulkan-1.dll 是硬链接依赖（非 delay-load），而干净系统
 * （无独显驱动、未装 VC 运行库）的 system32 里没有它，缺了进程在加载期就死（0xC0000135，
 * stderr 为空）。exe 目录在 DLL 搜索顺序里优先于 system32，所以 loader 与 exe 同目录分发。
 * 运行包同时含 x86 版本与 pdb，只取 x64；与 release.yml 的 Package 步骤同一来源、同一版本。
 *
 * @param {string} targetDir loader 与许可证的落地目录（exe 同级）。
 * @returns {Promise<void>} 下载、解压或拷贝失败时抛出。
 */
async function installVulkanLoaderForWindows(targetDir) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-vulkan-'));
    const archiveName = 'vulkan-runtime-components.zip';
    await download({url: VULKAN_RUNTIME_COMPONENTS_URL, dir: tmpRoot, file: archiveName});
    const extractDir = path.join(tmpRoot, 'extract');
    await extractArchive(path.join(tmpRoot, archiveName), extractDir);

    const loader = findFirstFile(
        extractDir,
        (p) => /^x64$/i.test(path.basename(path.dirname(p))) && path.basename(p).toLowerCase() === 'vulkan-1.dll',
        12
    );
    if (!loader) throw new Error(`Vulkan 运行包里找不到 x64/vulkan-1.dll：${VULKAN_RUNTIME_COMPONENTS_URL}`);
    const license = findFirstFile(extractDir, (p) => path.basename(p) === 'VulkanRT-License.txt', 12);
    if (!license) throw new Error(`Vulkan 运行包里找不到 VulkanRT-License.txt：${VULKAN_RUNTIME_COMPONENTS_URL}`);

    for (const src of [loader, license]) {
        const dest = path.join(targetDir, path.basename(src));
        fs.copyFileSync(src, dest);
        console.info(chalk.green(`✅ vulkan runtime: ${src} -> ${dest}`));
    }
}

/**
 * 校验 Windows whisper.cpp 运行时是否与 exe 配套：缺 vulkan-1.dll 时在干净系统上
 * 加载期就失败（0xC0000135、stderr 为空），必须当场抛错，而不是留下一个默认
 * 识别引擎不可用的运行时。
 * @param {string} basePath 运行时目录。
 */
const assertWhisperWindowsRuntimeComplete = (basePath) => {
    if (platform !== 'win32') return;
    const loaderPath = path.join(basePath, 'vulkan-1.dll');
    if (!fs.existsSync(loaderPath)) {
        throw new Error(`whisper.cpp Windows 运行时缺少 vulkan-1.dll：${loaderPath}，parakeet-cli 在无显卡驱动的系统上会直接起不来`);
    }
};

/**
 * 本地源码构建 whisper.cpp parakeet-cli（开发机获取运行时的唯一路径）。
 *
 * 复刻 release.yml whisper-cpp-runtime 任务的构建参数：静态链接
 * （BUILD_SHARED_LIBS=OFF），macOS Metal 内嵌 GGML 库
 * （GGML_METAL_EMBED_LIBRARY=ON），产出单文件自包含二进制。
 * 源码缓存在 node_modules/.cache/whisper.cpp（不随应用打包，也不进 git）。
 * 只在开发机调用：CI 侧由 release.yml 的 whisper-cpp-runtime 任务提供预编译产物。
 *
 * @param {{ basePath: string, exeName: string }} param 目标目录与可执行文件名。
 * @returns {Promise<boolean>} 构建成功且二进制已就位时 true；缺少构建依赖或构建失败时
 *   false（原因已打印），由调用方按“运行时暂缺”处理（whisper 引擎在运行时会显式报错）。
 */
async function buildWhisperCppFromSource({ basePath, exeName }) {
    const { execSync } = await import('node:child_process');
    // Vulkan 目标的硬依赖来自 ggml 的 find_package(Vulkan COMPONENTS glslc REQUIRED)：
    // 缺 glslc 时 cmake 只会抛底层报错，这里先给出能直接照做的安装提示。
    const isMac = platform === 'darwin';
    const requiredTools = isMac
        ? [
            { bin: 'cmake', hint: 'macOS: brew install cmake' },
            { bin: 'git', hint: 'macOS: brew install git' },
        ]
        : [
            { bin: 'cmake', hint: '请先安装 cmake' },
            { bin: 'git', hint: '请先安装 git' },
            {
                bin: 'glslc',
                hint: platform === 'win32'
                    ? 'Windows: 安装 LunarG Vulkan SDK 1.4.x（同时提供 glslc 与 SPIRV-Headers）'
                    : 'Linux: 需 glslc + SPIRV-Headers（Ubuntu 24.04: apt install glslc libvulkan-dev spirv-headers；22.04: 用 LunarG 的 jammy 源装 vulkan-sdk）',
            },
        ];
    for (const tool of requiredTools) {
        try {
            execSync(`${tool.bin} --version`, { stdio: 'ignore' });
        } catch {
            console.info(chalk.yellow(`=> 本地构建 whisper.cpp 需要 ${tool.bin}；${tool.hint}`));
            return false;
        }
    }

    const srcDir = path.join(process.cwd(), 'node_modules', '.cache', 'whisper.cpp');
    const buildDir = path.join(srcDir, 'build');
    mkdirp(srcDir);
    let needFetch = false;
    try {
        needFetch = execSync('git rev-parse HEAD', { cwd: srcDir, encoding: 'utf8' }).trim() !== WHISPER_CPP_REF;
    } catch {
        // 本地缓存还不是 git 仓库（首次构建）
        needFetch = true;
    }
    if (needFetch) {
        console.info(chalk.blue(`=> Fetching whisper.cpp @ ${WHISPER_CPP_REF.slice(0, 8)}...`));
        // 换 ref 后必须丢弃上一份源码的构建缓存，否则 cmake 会复用另一棵源码树的 cache
        fs.rmSync(buildDir, { recursive: true, force: true });
        try {
            execSync(`git init "${srcDir}"`, { stdio: 'ignore' });
            let hasOrigin = true;
            try {
                execSync(`git -C "${srcDir}" remote get-url origin`, { stdio: 'ignore' });
            } catch {
                hasOrigin = false;
            }
            execSync(
                hasOrigin
                    ? `git -C "${srcDir}" remote set-url origin https://github.com/ggml-org/whisper.cpp`
                    : `git -C "${srcDir}" remote add origin https://github.com/ggml-org/whisper.cpp`,
                { stdio: 'inherit' },
            );
            execSync(`git -C "${srcDir}" fetch --depth 1 origin ${WHISPER_CPP_REF}`, { stdio: 'inherit' });
            execSync(`git -C "${srcDir}" checkout --detach FETCH_HEAD`, { stdio: 'inherit' });
        } catch (error) {
            console.info(chalk.yellow(`=> whisper.cpp 源码获取失败：${error.message}`));
            return false;
        }
    }

    const gpuFlags = isMac
        ? ['-DGGML_METAL=ON', '-DGGML_METAL_USE_BF16=ON', '-DGGML_METAL_EMBED_LIBRARY=ON', `-DCMAKE_OSX_ARCHITECTURES=${arch === 'arm64' ? 'arm64' : 'x86_64'}`]
        : [
            '-DGGML_VULKAN=ON',
            // Windows 三个参数与 release.yml 的 Configure (Vulkan) 步骤逐字对齐，缺一不可：
            // CMP0091 为 OLD 时 CMAKE_MSVC_RUNTIME_LIBRARY 会被静默忽略（whisper.cpp 顶层
            // cmake_minimum_required 只有 3.5），必须显式抬成 NEW；静态 CRT 去
            // VCRUNTIME140.dll / MSVCP140.dll；关 OpenMP 去 vcomp140.dll（ggml 自带线程池）
            ...(platform === 'win32'
                ? ['-DCMAKE_POLICY_DEFAULT_CMP0091=NEW', '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded', '-DGGML_OPENMP=OFF']
                : []),
        ];
    if (platform === 'win32') {
        // 与 exe 配套的 loader 先落地：缺件要在开跑几分钟编译之前就暴露
        await installVulkanLoaderForWindows(basePath);
    }
    console.info(chalk.blue('=> Building whisper.cpp parakeet-cli (first build takes a few minutes)...'));
    try {
        execSync(
            [
                'cmake -B build',
                '-DCMAKE_BUILD_TYPE=Release',
                '-DGGML_NATIVE=OFF',
                '-DBUILD_SHARED_LIBS=OFF',
                '-DWHISPER_BUILD_EXAMPLES=ON',
                '-DWHISPER_BUILD_TESTS=OFF',
                ...gpuFlags,
            ].join(' '),
            { cwd: srcDir, stdio: 'inherit' },
        );
        execSync(`cmake --build build --config Release --target parakeet-cli -j 4`, { cwd: srcDir, stdio: 'inherit' });
    } catch (error) {
        console.info(chalk.yellow(`=> whisper.cpp 构建失败：${error.message}`));
        return false;
    }

    const builtPath = platform === 'win32'
        ? path.join(buildDir, 'bin', 'Release', 'parakeet-cli.exe')
        : path.join(buildDir, 'bin', 'parakeet-cli');
    if (!fs.existsSync(builtPath)) {
        console.info(chalk.yellow(`=> whisper.cpp 构建产物未找到：${builtPath}`));
        return false;
    }
    fs.copyFileSync(builtPath, path.join(basePath, exeName));
    assertWhisperWindowsRuntimeComplete(basePath);
    console.info(chalk.green(`✅ whisper.cpp parakeet-cli built and installed to ${basePath}`));
    return true;
}

{
    // whisper.cpp 离线识别 CLI（whisper.cpp 引擎的核显加速运行时）。
    // 二进制跟着安装包一起分发，来源只有两个：
    //   1) DASHPLAYER_WHISPER_RUNTIME_DIR 指定目录里已有归档：release.yml 的
    //      whisper-cpp-runtime 任务构建出的产物在本次运行内直接传给 app 构建；
    //   2) 其余情况（开发机）：按固定 ref 本地编译源码（buildWhisperCppFromSource）。
    // 运行时不上传 Release：发版资产只放安装包。
    const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
    const archDir = arch === 'arm64' ? 'arm64' : 'x64';
    const basePath = path.join(dir, 'whisper-cpp', archDir, platformDir);
    mkdirp(basePath);

    const exeName = platform === 'win32' ? 'parakeet-cli.exe' : 'parakeet-cli';
    const exePath = path.join(basePath, exeName);
    const markerPath = path.join(basePath, WHISPER_RUNTIME_MARKER);

    // 核显运行时仅覆盖主流桌面平台；其余平台由 sherpa-onnx 引擎兜底
    const supportedArchs = { linux: ['x64'], win32: ['x64'], darwin: ['arm64', 'x64'] };
    if (!supportedArchs[platform]?.includes(arch)) {
        console.info(chalk.yellow(`=> whisper.cpp 暂不提供 ${platform}/${arch} 运行时，已跳过；whisper.cpp 引擎在该平台不可用，请使用 sherpa-onnx 引擎`));
    } else {
        // CI 会把本次运行的运行时产物目录传进来（release.yml 的 whisper-cpp-runtime
        // 任务产出 artifact，再由 app 构建任务下载到该目录）
        const localArchiveDir = process.env.DASHPLAYER_WHISPER_RUNTIME_DIR;
        const localArchivePath = localArchiveDir
            ? path.join(localArchiveDir, whisperRuntimeAssetName(platform, arch))
            : null;
        const localArchiveExists = Boolean(localArchivePath && fs.existsSync(localArchivePath));

        // parakeet-cli 的输出格式是解析契约（见 WhisperCppCli.parseOutput），所以已装的
        // 二进制必须带上来源：标记与预期不符（换了 whisper.cpp ref / 换了配方 / 手工放置）
        // 就重新安装。二进制内容由 ref 与配方共同决定，标记统一是 source:<ref>+<配方>。
        const expectedMarker = `source:${WHISPER_CPP_REF}+${WHISPER_RUNTIME_RECIPE}`;
        const installedMarker = readWhisperRuntimeMarker(markerPath);
        if (fs.existsSync(exePath) && installedMarker === expectedMarker) {
            console.info(chalk.green(`✅ File ${exeName} already exists (${expectedMarker})`));
        } else {
            if (fs.existsSync(exePath) && installedMarker === null) {
                console.info(chalk.yellow(`=> 现有 ${exeName} 没有来源标记（手工放置或旧版本安装），按 ${expectedMarker} 重新安装以对齐版本`));
            }
            if (localArchiveExists) {
                console.info(chalk.blue(`=> whisper.cpp target: ${exePath}`));
                console.info(chalk.blue(`=> whisper.cpp 使用本地运行归档：${localArchivePath}`));
                await installBinaryFromArchive({
                    archivePath: localArchivePath,
                    outputPath: exePath,
                    binaryNameCandidates: ['parakeet-cli', 'parakeet-cli.exe'],
                    // Windows 归档里 exe 之外还有 loader 与许可证（release.yml 的 Package 步骤打包）
                    extraCopyPatterns: platform === 'win32' ? [/^vulkan-1\.dll$/i, /^VulkanRT-License\.txt$/] : [],
                });
                assertWhisperWindowsRuntimeComplete(basePath);
                fs.writeFileSync(markerPath, `${expectedMarker}\n`);
            } else if (process.env.CI) {
                // CI 上不许编译兜底：缺运行时说明 whisper-cpp-runtime 没产出该平台产物，
                // 而 whisper.cpp 是新用户的默认识别引擎，必须让该平台构建显式失败
                console.error(
                    chalk.red(
                        `❌ whisper.cpp 运行时缺失：CI 应从 DASHPLAYER_WHISPER_RUNTIME_DIR 取得归档\n` +
                        `   期望路径：${localArchivePath ?? '（变量未设置）'}\n` +
                        `   请检查 release.yml 的 whisper-cpp-runtime 任务是否成功构建了 ${platform}/${arch} 运行时。`
                    )
                );
                process.exit(1);
            } else {
                // 开发机：没有预编译产物，回退到本地源码编译（缺工具链时上面已有安装提示）
                const built = await buildWhisperCppFromSource({ basePath, exeName });
                if (built) {
                    fs.writeFileSync(markerPath, `${expectedMarker}\n`);
                } else {
                    console.info(chalk.yellow(`=> whisper.cpp 运行时暂缺且本地构建未完成，已跳过；识别引擎可暂用 sherpa-onnx`));
                    console.info(chalk.yellow(`   手动放置二进制时请一并写入来源标记 ${markerPath}（内容 ${expectedMarker}），否则下次 yarn run download 会重新安装`));
                }
            }
        }
    }
}
