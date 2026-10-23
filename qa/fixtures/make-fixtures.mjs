#!/usr/bin/env node
/**
 * 生成播放器端到端用例所需的媒体夹具（双语 SRT + 小体积视频）。
 *
 * 产物落在 `qa/fixtures/media/`，按 QA 目录约定不入库（`qa/.gitignore` 排除），由 globalSetup 按需生成：
 * 用例不再依赖本机媒体库，也不需要「入库 → 点进去 → 拖进度条」这套人工前置。
 *
 * 双语字幕的格式约束来自解析器 `src/common/utils/subtitle/parser.ts`：
 * 逐个正文行判断是否含中文，含中文的行进 `contentZh`，其余进 `contentEn`。
 * 因此每个字幕块必须是「英文一行 + 中文一行」两行，侧栏译文行才有内容可渲染。
 *
 * 用法：`node qa/fixtures/make-fixtures.mjs`（需要 ffmpeg 与 ffprobe 在 PATH 上；
 * 正常不用手跑——`qa/playwright.config.ts` 的 globalSetup 缺则自动生成）。
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** 仓库根目录。 */
const projectDir = fileURLToPath(new URL('../../', import.meta.url));

/** 夹具输出目录（会被用例直接引用，随仓库入库）。 */
const outputDir = path.join(projectDir, 'qa', 'fixtures', 'media');

/** 句子数量：足够撑出可滚动列表（约 30+ 行）。 */
const SENTENCE_COUNT = 36;

/** 单句时长（秒）；视频总时长 = 句数 × 该值。 */
const SENTENCE_SECONDS = 2;

/** 视频分辨率：刻意取小尺寸，保证入库体积。 */
const VIDEO_WIDTH = 480;

/** 视频分辨率。 */
const VIDEO_HEIGHT = 270;

/** 视频帧率：夹具只用于滚动行为，帧率越低文件越小。 */
const VIDEO_FPS = 6;

/**
 * 英文句子素材（循环取用，保证每条都可读且长度接近真实字幕）。
 */
const ENGLISH_SENTENCES = [
    'The player keeps your reading position steady while the layout changes.',
    'Row heights shift as soon as the sidebar translation is toggled.',
    'A stable anchor is what separates a calm list from a jumping one.',
    'We measure the anchor in layout pixels, never in visual pixels.',
    'The scroller reports its offset relative to the scrolling container.',
    'Convergence means the residual stops changing between two rounds.',
    'If either snapshot is missing the hold intent refuses to scroll.',
    'Virtualised lists recycle their DOM nodes, so we track data indexes.',
];

/**
 * 中文句子素材（与英文逐条对应，长度也做近似对齐）。
 */
const CHINESE_SENTENCES = [
    '界面重新排版时，播放器会让你的阅读位置保持不动。',
    '只要切换侧栏译文，行高就会立刻发生变化。',
    '稳定的锚点决定了列表是安静还是乱跳。',
    '我们只用布局像素度量锚点，绝不用视觉像素。',
    '滚动容器报告的偏移量都相对容器顶部。',
    '收敛的意思是两轮之间残差不再变化。',
    '任一快照缺失时，保持意图会拒绝滚动。',
    '虚拟列表会回收 DOM 节点，所以我们用数据下标定位。',
];

/**
 * 把秒数格式化为 SRT 时间轴（HH:MM:SS,mmm）。
 *
 * @param seconds 秒数。
 * @returns SRT 时间轴字符串。
 */
function toSrtTimestamp(seconds) {
    const totalMs = Math.round(seconds * 1000);
    const ms = totalMs % 1000;
    const totalSeconds = (totalMs - ms) / 1000;
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    const pad = (value, width) => String(value).padStart(width, '0');
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

/**
 * 生成双语 SRT 文本：每块两行，英文在前、中文在后。
 *
 * @returns SRT 文本。
 */
function buildBilingualSrt() {
    const blocks = [];
    for (let i = 0; i < SENTENCE_COUNT; i += 1) {
        const start = i * SENTENCE_SECONDS;
        const end = start + SENTENCE_SECONDS - 0.05;
        const english = ENGLISH_SENTENCES[i % ENGLISH_SENTENCES.length];
        const chinese = CHINESE_SENTENCES[i % CHINESE_SENTENCES.length];
        blocks.push(
            [
                String(i + 1),
                `${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}`,
                `${i + 1}. ${english}`,
                chinese,
            ].join('\n'),
        );
    }
    return `${blocks.join('\n\n')}\n`;
}

/**
 * 用 ffmpeg 生成一段可被 Electron 直接播放的小体积视频。
 *
 * 画面刻意保持静态（纯色 + 计时进度块），配合低帧率与高 CRF，让 60 秒素材只有几百 KB。
 *
 * @param videoPath 输出视频绝对路径。
 * @returns 生成完成后结束。
 */
async function renderFixtureVideo(videoPath) {
    const duration = SENTENCE_COUNT * SENTENCE_SECONDS;
    const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=0x12161f:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=${VIDEO_FPS}:d=${duration}`,
        // 进度条：宽度随时间线性增长，用来看视频是否真的在播放
        '-f', 'lavfi',
        '-i', `color=c=0x38bdf8:s=${VIDEO_WIDTH}x8:r=${VIDEO_FPS}:d=${duration}`,
        '-f', 'lavfi',
        '-i', `anullsrc=channel_layout=mono:sample_rate=16000:d=${duration}`,
        '-filter_complex', '[0:v][1:v]overlay=0:H-h:shortest=1[v]',
        '-map', '[v]',
        '-map', '2:a',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '40',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'baseline',
        '-c:a', 'aac',
        '-b:a', '16k',
        '-shortest',
        '-movflags', '+faststart',
        videoPath,
    ];
    await execFileAsync('ffmpeg', args);
}

/**
 * 生成全部夹具并打印产物清单。
 *
 * @returns 生成完成后结束。
 */
async function main() {
    await fs.mkdir(outputDir, { recursive: true });

    const srtPath = path.join(outputDir, 'qa-bilingual.srt');
    const videoPath = path.join(outputDir, 'qa-bilingual.mp4');

    await fs.writeFile(srtPath, buildBilingualSrt(), 'utf8');
    await renderFixtureVideo(videoPath);

    // 体积与时长都实测后打印：夹具入库前先确认没有失控
    const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath,
    ]);

    for (const file of [srtPath, videoPath]) {
        const stat = await fs.stat(file);
        console.log(`[qa-fixtures] ${path.relative(projectDir, file)}  ${(stat.size / 1024).toFixed(1)} KB`);
    }
    console.log(`[qa-fixtures] 视频时长 ${Number(stdout.trim()).toFixed(2)}s，句数 ${SENTENCE_COUNT}`);
}

await main();
