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
    const res = await axios.get(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'DashPlayer-downloader',
            ...getGithubAuthHeaders(apiUrl),
        }
    });
    const assets = res.data?.assets ?? [];
    const match = assets.find((a) => nameRegex.test(a?.name || ''));
    return match?.browser_download_url || null;
};

const getLatestReleaseAssetUrlIncludingPrerelease = async ({owner, repo, nameRegex}) => {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;
    const res = await axios.get(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'DashPlayer-downloader',
            ...getGithubAuthHeaders(apiUrl),
        }
    });
    const releases = res.data ?? [];
    for (const release of releases) {
        const assets = release?.assets ?? [];
        const match = assets.find((a) => nameRegex.test(a?.name || ''));
        if (match?.browser_download_url) return match.browser_download_url;
    }
    return null;
};

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

    const extractDir = path.join(tmpRoot, 'extract');
    await extractArchive(archivePath, extractDir);

    const found = findFirstFile(
        extractDir,
        (p) => binaryNameCandidates.includes(path.basename(p)),
        12
    );
    if (!found) {
        throw new Error(`Cannot find binary in archive from ${url}`);
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
 * 下载文件并校验可选的 SHA1 摘要。
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
                const hash = await hashFile(path.join(dir, file), {algo: "sha1"});
                if (sha === undefined || hash === sha) {
                    console.info(chalk.green(`✅ File ${file} valid`));
                    resolve();
                } else {
                    console.error(
                        chalk.red(
                            `❌ File ${file} not valid, please try again using command \`yarn download\``
                        )
                    );
                    reject();
                }
            });
        });
    } catch (err) {
        console.error(
            chalk.red(
                `❌ Failed to download ${url}: ${err}.\nPlease try again using command \`yarn download\``
            )
        );
        process.exit(1);
    }
}

{
    // whisper.cpp 离线识别 CLI（whisper.cpp 引擎的核显加速运行时）。
    // 资产随应用 Release 一起发布：release.yml 的 whisper-cpp-runtime 任务
    // 在发版时构建四个目标并上传；本段从当前版本对应的 Release 下载。
    const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
    const archDir = arch === 'arm64' ? 'arm64' : 'x64';
    const basePath = path.join(dir, 'whisper-cpp', archDir, platformDir);
    mkdirp(basePath);

    const exeName = platform === 'win32' ? 'parakeet-cli.exe' : 'parakeet-cli';
    const exePath = path.join(basePath, exeName);
    const res = await verifyExistence({ dir: basePath, file: exeName });

    // 核显运行时仅覆盖主流桌面平台；其余平台由 sherpa-onnx 引擎兜底
    const supportedArchs = { linux: ['x64'], win32: ['x64'], darwin: ['arm64', 'x64'] };
    if (res === 'need_download') {
        if (!supportedArchs[platform]?.includes(arch)) {
            console.info(chalk.yellow(`=> whisper.cpp 暂不提供 ${platform}/${arch} 运行时，已跳过；whisper.cpp 引擎在该平台不可用，请使用 sherpa-onnx 引擎`));
        } else {
            const version = packageJson.version;
            const assetName = `whisper-cpp-${platform}-${arch}.tar.gz`;
            const assetUrl = `https://github.com/solidSpoon/DashPlayer/releases/download/v${version}/${assetName}`;
            // 预检资产是否存在：download() 对任何失败都会终止整个脚本，
            // 而资产缺失（本地开发、历史版本）是可跳过的合法状态，只对 404 放行跳过
            let assetExists = true;
            try {
                await axios.head(assetUrl, { headers: getGithubAuthHeaders(assetUrl) });
            } catch (error) {
                if (error?.response?.status === 404) {
                    assetExists = false;
                }
            }
            if (!assetExists) {
                console.info(chalk.yellow(`=> whisper.cpp 运行时资产尚未随 v${version} 发布，已跳过；识别引擎可暂用 sherpa-onnx，或手动将二进制放置到 ${exePath}`));
            } else {
                console.info(chalk.blue(`=> whisper.cpp target: ${exePath}`));
                await downloadAndExtractBinaryFromArchive({
                    url: assetUrl,
                    outputPath: exePath,
                    binaryNameCandidates: ['parakeet-cli', 'parakeet-cli.exe'],
                });
            }
        }
    }
}
