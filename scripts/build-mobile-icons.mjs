/**
 * 生成手机页用的图标，全部从 assets/icons 里已有的素材派生，不做手工修图。
 *
 * 两份产物：
 * - `mobile-icon.svg`：从应用图标 icon.svg 的底板矩形与 glyph / star 路径 1:1 复刻，
 *   画布就是底板范围，去掉底板圆角和投影——也就是「满幅方图」。浏览器和 iOS 会给图标自己加圆角，
 *   图标自带圆角底板时就会出现「圆角矩形套圆角矩形」，四角还会露出一圈投影。
 * - `apple-touch-180.png`：iOS 主屏图标只认位图，这里把 icon@2x.png 按同一块底板范围裁切、
 *   按面积平均缩放到 180、四角透明处压成底板白，结果与上面那份 SVG 视觉一致。
 *   位图编解码用 node:zlib 自己实现（见文件末尾），不引入任何新依赖。
 *
 * 用法：node scripts/build-mobile-icons.mjs（改完应用图标重跑一次即可）
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const masterPath = path.join(root, 'assets/icons/icon.svg');
const rasterPath = path.join(root, 'assets/icons/icon@2x.png');
const svgOutPath = path.join(root, 'assets/icons/mobile-icon.svg');
const pngOutPath = path.join(root, 'assets/icons/apple-touch-180.png');

/** iOS 主屏图标边长（像素）。 */
const TOUCH_ICON_SIZE = 180;

const master = fs.readFileSync(masterPath, 'utf8');

/**
 * 从主图标里取出某个元素的完整标签与属性。
 *
 * @param {string} pattern 定位该元素的正则（需带一个捕获属性串的分组）。
 * @returns {{attrs: string, body: string}}
 */
const readElement = (pattern) => {
    const match = master.match(pattern);
    if (!match) {
        throw new Error(`assets/icons/icon.svg 里找不到匹配 ${pattern} 的元素`);
    }
    return { attrs: match[1], body: match[2] ?? '' };
};

/**
 * 从属性串里读取某个属性的值。
 *
 * @param {string} attrs 属性串。
 * @param {string} name 属性名。
 * @param {string} fallback 缺省值。
 * @returns {string}
 */
const readAttr = (attrs, name, fallback) => {
    const match = new RegExp(`${name}="([^"]*)"`).exec(attrs);
    return match ? match[1] : fallback;
};

// 底板决定画布范围与底色；glyph / star 只取路径数据，投影一律丢掉
const plate = readElement(/<rect id="plate"([^>]*)>/);
const glyph = readElement(/<path id="glyph"([^>]*?) d="([\s\S]*?)"/);
const star = readElement(/<path id="star"([^>]*?) d="([\s\S]*?)"/);

const plateBox = {
    x: Number(readAttr(plate.attrs, 'x', '0')),
    y: Number(readAttr(plate.attrs, 'y', '0')),
    width: Number(readAttr(plate.attrs, 'width', '0')),
    height: Number(readAttr(plate.attrs, 'height', '0')),
    fill: readAttr(plate.attrs, 'fill', '#FFFFFF'),
};
if (!(plateBox.width > 0 && plateBox.height > 0)) {
    throw new Error(`icon.svg 的底板尺寸不合法：${JSON.stringify(plateBox)}`);
}

/** 满幅 SVG：画布=底板范围，无圆角、无投影，只保留底板底色与两层图形。 */
const buildMobileSvg = () => {
    const viewBox = `${plateBox.x} ${plateBox.y} ${plateBox.width} ${plateBox.height}`;
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="' + viewBox + '">',
        '  <!--',
        '    手机页图标：由 scripts/build-mobile-icons.mjs 从 assets/icons/icon.svg 自动生成，不要直接改这里。',
        '    与应用图标是同一套图形，区别只有两点：画布收紧到底板范围（满幅，系统加圆角时才不会套圆角），',
        '    以及去掉底板圆角与所有投影（那层圆角边框和投影在系统圆角里会露出来）。',
        '  -->',
        `  <rect id="plate" x="${plateBox.x}" y="${plateBox.y}" width="${plateBox.width}" height="${plateBox.height}" fill="${plateBox.fill}"/>`,
        '',
        '  <!-- 字母 d -->',
        `  <path id="glyph" fill="${readAttr(glyph.attrs, 'fill', '#5A5A5A')}" d="${glyph.body.trim()}"/>`,
        '',
        '  <!-- 星星 -->',
        `  <path id="star" fill="${readAttr(star.attrs, 'fill', '#FFD700')}" d="${star.body.trim()}"/>`,
        '</svg>',
        '',
    ].join('\n');
};

/** CRC32 查表（PNG 的每个 chunk 都要）。 */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value >>> 0;
    }
    return table;
})();

/**
 * 计算 CRC32。
 *
 * @param {Buffer} buffer 待计算数据。
 * @returns {number}
 */
const crc32 = (buffer) => {
    let crc = 0xFFFFFFFF;
    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
};

/**
 * 解码 8 位、非隔行的 PNG 为 RGBA 像素。
 *
 * 只处理本仓库图标用到的格式（彩色/灰度、带或不带 alpha），遇到别的组合直接报错，
 * 避免「静默画出一张错的图」。
 *
 * @param {Buffer} file PNG 文件内容。
 * @returns {{width: number, height: number, data: Uint8Array}} RGBA 像素，每像素 4 字节。
 */
const decodePng = (file) => {
    if (!file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
        throw new Error('不是 PNG 文件');
    }

    let offset = 8;
    let header = null;
    const idatChunks = [];
    while (offset < file.length) {
        const length = file.readUInt32BE(offset);
        const type = file.toString('ascii', offset + 4, offset + 8);
        const data = file.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            header = {
                width: data.readUInt32BE(0),
                height: data.readUInt32BE(4),
                bitDepth: data[8],
                colorType: data[9],
                interlace: data[12],
            };
        } else if (type === 'IDAT') {
            idatChunks.push(data);
        } else if (type === 'IEND') {
            break;
        }
        offset += 12 + length;
    }

    if (header === null) {
        throw new Error('PNG 缺少 IHDR');
    }
    if (header.bitDepth !== 8 || header.interlace !== 0) {
        throw new Error(`暂不支持 bitDepth=${header.bitDepth} interlace=${header.interlace} 的 PNG`);
    }

    /** 每个像素的通道数（按 PNG 规范的颜色类型）。 */
    const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const channels = channelsByColorType[header.colorType];
    if (channels === undefined || header.colorType === 3) {
        throw new Error(`暂不支持 colorType=${header.colorType} 的 PNG`);
    }

    const raw = zlib.inflateSync(Buffer.concat(idatChunks));
    const { width, height } = header;
    const stride = width * channels;
    const pixels = new Uint8Array(stride * height);

    // 逐行反过滤：每行首字节是过滤类型，Paeth/Up 等要参考上一行
    for (let y = 0; y < height; y += 1) {
        const filter = raw[y * (stride + 1)];
        const lineStart = y * (stride + 1) + 1;
        const target = y * stride;
        for (let x = 0; x < stride; x += 1) {
            const current = raw[lineStart + x];
            const left = x >= channels ? pixels[target + x - channels] : 0;
            const up = y > 0 ? pixels[target - stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? pixels[target - stride + x - channels] : 0;
            let value;
            switch (filter) {
                case 0:
                    value = current;
                    break;
                case 1:
                    value = current + left;
                    break;
                case 2:
                    value = current + up;
                    break;
                case 3:
                    value = current + ((left + up) >> 1);
                    break;
                case 4: {
                    const p = left + up - upLeft;
                    const pa = Math.abs(p - left);
                    const pb = Math.abs(p - up);
                    const pc = Math.abs(p - upLeft);
                    const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
                    value = current + predictor;
                    break;
                }
                default:
                    throw new Error(`未知的 PNG 过滤类型：${filter}`);
            }
            pixels[target + x] = value & 0xFF;
        }
    }

    // 统一成 RGBA，后续处理只认这一种布局
    const rgba = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        const source = index * channels;
        const target = index * 4;
        if (channels === 1) {
            rgba[target] = pixels[source];
            rgba[target + 1] = pixels[source];
            rgba[target + 2] = pixels[source];
            rgba[target + 3] = 255;
        } else if (channels === 2) {
            rgba[target] = pixels[source];
            rgba[target + 1] = pixels[source];
            rgba[target + 2] = pixels[source];
            rgba[target + 3] = pixels[source + 1];
        } else if (channels === 3) {
            rgba[target] = pixels[source];
            rgba[target + 1] = pixels[source + 1];
            rgba[target + 2] = pixels[source + 2];
            rgba[target + 3] = 255;
        } else {
            rgba[target] = pixels[source];
            rgba[target + 1] = pixels[source + 1];
            rgba[target + 2] = pixels[source + 2];
            rgba[target + 3] = pixels[source + 3];
        }
    }

    return { width, height, data: rgba };
};

/**
 * 把 RGBA 像素编码成 8 位 RGBA PNG。
 *
 * @param {Uint8Array} data RGBA 像素。
 * @param {number} width 宽度。
 * @param {number} height 高度。
 * @returns {Buffer}
 */
const encodePng = (data, width, height) => {
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y += 1) {
        raw[y * (stride + 1)] = 0; // 过滤类型 0（不过滤）
        Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }

    /** 组装一个 PNG chunk（长度 + 类型 + 数据 + CRC）。 */
    const chunk = (type, payload) => {
        const header = Buffer.alloc(8);
        header.writeUInt32BE(payload.length, 0);
        header.write(type, 4, 'ascii');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4, 8), payload])), 0);
        return Buffer.concat([header, payload, crc]);
    };

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bitDepth
    ihdr[9] = 6; // colorType: RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
};

/**
 * 把 PNG 裁到底板范围、缩放到目标边长，并把透明处压成底板白。
 *
 * 缩放用面积平均（每个目标像素取它在源图里的覆盖区域做平均），比最近邻少锯齿；
 * 先压白再平均，等价于「把图铺在白底上看」，不会出现边缘发黑的半透明混色。
 *
 * @param {{width: number, height: number, data: Uint8Array}} image 源图（RGBA）。
 * @param {{x: number, y: number, width: number, height: number, fill: string}} box 底板范围（按 1024 画布给出）。
 * @returns {{data: Uint8Array, size: number}}
 */
const buildTouchIcon = (image, box) => {
    /** 把 #RRGGBB 解析成三个 0-255 通道。 */
    const parseHex = (hex) => {
        const value = hex.replace('#', '');
        return [
            Number.parseInt(value.slice(0, 2), 16),
            Number.parseInt(value.slice(2, 4), 16),
            Number.parseInt(value.slice(4, 6), 16),
        ];
    };

    const scale = image.width / 1024;
    const crop = {
        left: Math.round(box.x * scale),
        top: Math.round(box.y * scale),
        width: Math.round(box.width * scale),
        height: Math.round(box.height * scale),
    };
    const [bgR, bgG, bgB] = parseHex(box.fill);

    const size = TOUCH_ICON_SIZE;
    const out = new Uint8Array(size * size * 4);
    // 每个目标像素对应的源区域大小；裁切区域不是 1:1 时也能工作
    const stepX = crop.width / size;
    const stepY = crop.height / size;

    for (let dy = 0; dy < size; dy += 1) {
        const yStart = crop.top + dy * stepY;
        const yEnd = yStart + stepY;
        for (let dx = 0; dx < size; dx += 1) {
            const xStart = crop.left + dx * stepX;
            const xEnd = xStart + stepX;

            let r = 0;
            let g = 0;
            let b = 0;
            let weight = 0;
            for (let sy = Math.floor(yStart); sy < Math.ceil(yEnd); sy += 1) {
                const overlapY = Math.min(yEnd, sy + 1) - Math.max(yStart, sy);
                if (overlapY <= 0) {
                    continue;
                }
                for (let sx = Math.floor(xStart); sx < Math.ceil(xEnd); sx += 1) {
                    const overlapX = Math.min(xEnd, sx + 1) - Math.max(xStart, sx);
                    const area = overlapX * overlapY;
                    if (area <= 0) {
                        continue;
                    }
                    const index = (sy * image.width + sx) * 4;
                    const alpha = image.data[index + 3] / 255;
                    // 先按 alpha 压到白底（等价于把整幅图铺在白底上），再参与平均
                    r += area * (image.data[index] * alpha + bgR * (1 - alpha));
                    g += area * (image.data[index + 1] * alpha + bgG * (1 - alpha));
                    b += area * (image.data[index + 2] * alpha + bgB * (1 - alpha));
                    weight += area;
                }
            }

            const target = (dy * size + dx) * 4;
            out[target] = Math.round(r / weight);
            out[target + 1] = Math.round(g / weight);
            out[target + 2] = Math.round(b / weight);
            out[target + 3] = 255;
        }
    }

    return { data: out, size };
};

const svg = buildMobileSvg();
fs.writeFileSync(svgOutPath, svg);
console.log(`生成 ${path.relative(root, svgOutPath)}（${svg.length} 字节）`);

const source = decodePng(fs.readFileSync(rasterPath));
const touch = buildTouchIcon(source, plateBox);
fs.writeFileSync(pngOutPath, encodePng(touch.data, touch.size, touch.size));
console.log(`生成 ${path.relative(root, pngOutPath)}（${touch.size}×${touch.size}）`);
