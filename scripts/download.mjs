#!/usr/bin/env zx

import axios from 'axios';
import fs from 'fs';
import progress from "progress";
import {createHash} from "crypto";
import os from "os";
import path from 'path';
import chalk from 'chalk';
import { $ } from 'zx';

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

/**
 * Verify the existence of the file
 * @param dir {string}
 * @param file {string}
 * @param sha {string | undefined}
 * @returns {Promise<'need_download' | 'pass'>}
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
 * Set proxy
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
 * Download file from url
 * @param url {string}
 * @param dir {string}
 * @param file {string}
 * @param sha {string | undefined}
 * @returns {Promise<void>}
 */
const download = async ({url, dir, file, sha}) => {
    const dest = path.join(dir, file);
    console.info(chalk.blue(`=> Start to download from ${url} to ${dest}`));
    try {
        const response = await axios.get(url, {responseType: "stream"});
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
};


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

const extractArchive = async (archivePath, destDir) => {
    if (archivePath.endsWith('.zip')) return extractZip(archivePath, destDir);
    if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) return extractTarGz(archivePath, destDir);
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
        }
    });
    const assets = res.data?.assets ?? [];
    const match = assets.find((a) => nameRegex.test(a?.name || ''));
    return match?.browser_download_url || null;
};

const downloadAndExtractBinaryFromArchive = async ({url, outputPath, binaryNameCandidates}) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-download-'));
    const nameFromUrl = String(url).split('/').pop() || 'asset';
    const archivePath = path.join(tmpRoot, nameFromUrl);
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
mkdirp(dir);

const platform = process.env.npm_config_platform || os.platform()
const arch = process.env.npm_config_arch || os.arch()

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
    // whisper.cpp (prefer whisper-cli; fallback to existing main if present)
    const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
    const archDir = arch === 'arm64' ? 'arm64' : 'x64';
    const basePath = path.join(dir, 'whisper.cpp', archDir, platformDir);
    mkdirp(basePath);

    const exeName = platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    const exePath = path.join(basePath, exeName);
    const res = await verifyExistence({ dir: basePath, file: exeName });

    if (res === 'need_download') {
        try {
            const archKey = arch === 'arm64' ? '(arm64|aarch64)' : '(x64|amd64|x86_64)';
            const platKey = platform === 'darwin' ? '(macos|darwin|osx)' : platform === 'win32' ? '(win|windows)' : '(linux)';
            const nameRegex = new RegExp(`whisper.*cli.*${platKey}.*${archKey}.*\\.(zip|tar\\.gz|tgz)$`, 'i');

            let assetUrl = await getLatestReleaseAssetUrl({ owner: 'ggml-org', repo: 'whisper.cpp', nameRegex });
            if (!assetUrl) {
                assetUrl = await getLatestReleaseAssetUrl({ owner: 'ggerganov', repo: 'whisper.cpp', nameRegex });
            }
            if (!assetUrl) {
                console.warn(chalk.yellow(`⚠️  whisper.cpp release asset not found for ${platform}/${arch}, skip download`));
            } else {
                await downloadAndExtractBinaryFromArchive({
                    url: assetUrl,
                    outputPath: exePath,
                    binaryNameCandidates: platform === 'win32' ? ['whisper-cli.exe', 'main.exe'] : ['whisper-cli', 'main'],
                });
            }
        } catch (e) {
            console.warn(chalk.yellow(`⚠️  whisper.cpp download failed, keep existing binaries: ${e instanceof Error ? e.message : String(e)}`));
        }
    }
}
