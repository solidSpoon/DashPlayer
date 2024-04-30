#!/usr/bin/env zx

import axios from 'axios';
import fs from 'fs';
import progress from "progress";
import {createHash} from "crypto";
import os from "os";

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
                if (sha === undefined | hash === sha) {
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

/**
 * URL structure for different platforms
 * @type {{darwin: string, win32: string}}
 */
const platformUrls = {
    darwin: {
        x64: '',
        arm64: '',
    },
    win32: {
        x64: '',
        ia32: '',
    }
}

const FFMPEG_BASE_URL = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/'
/**
 * URLs for different tools
 * @type {{ffprobe: typeof platformUrls, ffmpeg: typeof platformUrls}}
 */
const urls = {
    ffmpeg: {
        darwin: {
            x64: `${FFMPEG_BASE_URL}ffmpeg-darwin-x64`,
            arm64: `${FFMPEG_BASE_URL}ffmpeg-darwin-arm64`
        },
        win32: {
            x64: `${FFMPEG_BASE_URL}ffmpeg-win32-x64`,
            ia32: `${FFMPEG_BASE_URL}ffmpeg-win32-ia32`,
        }
    },
    ffprobe: {
        darwin: {
            x64: `${FFMPEG_BASE_URL}ffprobe-darwin-x64`,
            arm64: `${FFMPEG_BASE_URL}ffprobe-darwin-arm64`
        },
        win32: {
            x64: `${FFMPEG_BASE_URL}ffprobe-win32-x64`,
            ia32: `${FFMPEG_BASE_URL}ffprobe-win32-ia32`,
        }
    },
    'yt-dlp': {
        darwin: {
            x64: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
            arm64: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
        },
        win32: {
            x64: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
            ia32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        }
    }
}

////////////////////
setProxy();
const dir = path.join(process.cwd(), 'lib');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

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
        const downloadUrl = urls.ffmpeg[platform][arch];
        await download({url: downloadUrl, dir, file});
        fs.chmodSync(path.join(dir, file), 0o755);
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
        const downloadUrl = urls.ffprobe[platform][arch];
        await download({url: downloadUrl, dir, file});
        fs.chmodSync(path.join(dir, file), 0o755);
    }
}

{
    // yt-dlp
    const file = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const res = await verifyExistence({
        dir,
        file,
    });
    if (res === 'need_download') {
        const downloadUrl = urls['yt-dlp'][platform][arch];
        await download({url: downloadUrl, dir, file});
        fs.chmodSync(path.join(dir, file), 0o755);
    }
}
