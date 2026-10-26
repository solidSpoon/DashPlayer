import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Stats } from 'node:fs';

import type { MobileRecentItem, MobileWatchDetail } from '@/common/contracts/mobile-web';
import type { OpenAIDictionaryResult } from '@/common/types/DictionaryResult';
import { getMainLogger } from '@/backend/infrastructure/logger';

/**
 * 手机页 HTTP 服务需要的数据来源。
 *
 * 服务只负责协议与静态资源，业务数据全部由外部提供，避免把媒体库、
 * 字幕解析和查词逻辑塞进 HTTP 层。
 */
export interface MobileWebDataSource {
    /** 读取最近播放列表。 */
    listRecent(): Promise<MobileRecentItem[]>;
    /** 读取一条播放详情（含字幕）。 */
    getWatchDetail(id: string): Promise<MobileWatchDetail>;
    /** 解析观看记录对应的视频文件绝对路径。 */
    resolveVideoFile(id: string): Promise<string>;
    /** 生成或读取观看记录的大图，返回图片文件的绝对路径。 */
    getThumbnail(id: string): Promise<string>;
    /** 保存播放进度。 */
    saveProgress(id: string, position: number): Promise<void>;
    /** 查询单词释义。 */
    lookupWord(word: string): Promise<OpenAIDictionaryResult | null>;
    /** 批量翻译字幕行，返回与入参顺序一致的结果。 */
    translateTexts(texts: string[]): Promise<string[]>;
}

/**
 * 创建手机页 HTTP 服务的参数。
 */
export interface MobileWebServerOptions {
    /** 存放 index.html / app.css / app.js 的目录。 */
    staticDirectory: string;
    /** 业务数据来源。 */
    source: MobileWebDataSource;
}

/** 静态构建产物的扩展名到 Content-Type 映射。 */
const STATIC_CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json; charset=utf-8',
};

/**
 * 把静态文件扩展名转换为 Content-Type。
 *
 * @param filePath 文件路径。
 * @returns Content-Type；未知扩展名返回 application/octet-stream。
 */
const staticContentType = (filePath: string): string => {
    return STATIC_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
};

/** 媒体扩展名到 Content-Type 的映射；未知类型交给浏览器按八位流处理。 */
const MEDIA_CONTENT_TYPES: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.ts': 'video/mp2t',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
};

/** 进度请求体允许的最大字节数。 */
const MAX_JSON_BODY_BYTES = 16 * 1024;

/**
 * 把文件扩展名转换为浏览器可识别的 Content-Type。
 *
 * @param filePath 媒体文件路径。
 * @returns Content-Type；未知扩展名返回 application/octet-stream。
 */
const mediaContentType = (filePath: string): string => {
    return MEDIA_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
};

/**
 * 解析 Range 请求头。
 *
 * 只支持单段范围（浏览器播放视频时实际只发单段）。返回值中的 end 已根据文件大小收敛，
 * 无法解析或范围越界时返回 null，由调用方回 416。
 *
 * @param header Range 请求头原文。
 * @param size 文件总字节数。
 * @returns 起始与结束字节（闭区间）；不合法时为 null。
 */
const parseRange = (header: string, size: number): { start: number; end: number } | null => {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
    if (!match) {
        return null;
    }
    if (size <= 0) {
        return null;
    }

    const startText = match[1];
    const endText = match[2];
    if (startText === '' && endText === '') {
        return null;
    }

    let start: number;
    let end: number;
    if (startText === '') {
        // bytes=-N 表示最后 N 个字节
        const suffixLength = Number.parseInt(endText, 10);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
            return null;
        }
        start = Math.max(0, size - suffixLength);
        end = size - 1;
    } else {
        start = Number.parseInt(startText, 10);
        end = endText === '' ? size - 1 : Number.parseInt(endText, 10);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
        return null;
    }
    return { start, end: Math.min(end, size - 1) };
};

/**
 * 读取 JSON 请求体。
 *
 * @param request HTTP 请求。
 * @returns 解析后的对象。
 * @throws 请求体过大或不是合法 JSON 时抛出。
 */
const readJsonBody = (request: IncomingMessage): Promise<Record<string, unknown>> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let total = 0;
        let settled = false;

        const fail = (error: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            reject(error);
        };

        request.on('data', (chunk: Buffer) => {
            if (settled) {
                return;
            }
            total += chunk.length;
            if (total > MAX_JSON_BODY_BYTES) {
                // 不立刻 destroy 连接：让调用方能正常回一个 JSON 错误，浏览器也拿得到原因。
                fail(new Error('请求体过大'));
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            if (settled) {
                return;
            }
            settled = true;
            const text = Buffer.concat(chunks).toString('utf8');
            if (text.trim() === '') {
                resolve({});
                return;
            }
            try {
                const parsed: unknown = JSON.parse(text);
                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    reject(new Error('请求体必须是 JSON 对象'));
                    return;
                }
                resolve(parsed as Record<string, unknown>);
            } catch {
                reject(new Error('请求体不是合法 JSON'));
            }
        });
        request.on('error', (error) => fail(error));
    });
};

/**
 * 手机版页面的 HTTP 服务。
 *
 * 对外只提供五个只读/轻量写接口：最近播放、播放详情、视频流、进度写回和查词。
 * 视频流按 Range 响应，满足 iOS Safari 的拖动与分段加载要求。
 */
export default class MobileWebServer {
    private readonly logger = getMainLogger('MobileWebServer');
    private readonly staticDirectory: string;
    private readonly source: MobileWebDataSource;
    private server: http.Server | null = null;

    /**
     * 创建服务实例；此时还没有开始监听。
     *
     * @param options 静态目录与业务数据来源。
     */
    public constructor(options: MobileWebServerOptions) {
        this.staticDirectory = options.staticDirectory;
        this.source = options.source;
    }

    /**
     * 在指定端口启动监听。
     *
     * 不指定 host，由 Node 按双栈监听所有网卡，同时覆盖局域网直连和
     * IPv4/IPv6 回环，方便配合异地组网工具使用。
     *
     * @param port 监听端口，调用方需提前校验范围。
     */
    public async start(port: number): Promise<void> {
        if (this.server !== null) {
            throw new Error('手机访问服务已经在运行');
        }

        const server = http.createServer((request, response) => {
            void this.handle(request, response);
        });
        server.keepAliveTimeout = 5_000;
        server.on('clientError', (_error, socket) => {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        });

        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error): void => {
                server.off('listening', onListening);
                reject(error);
            };
            const onListening = (): void => {
                server.off('error', onError);
                resolve();
            };
            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(port);
        });

        this.server = server;
        this.logger.info('mobile web server started', { port });
    }

    /**
     * 停止监听并断开所有连接。
     *
     * 视频流是长连接，必须主动 closeAllConnections，否则关闭端口时旧连接会拖着服务不退出。
     */
    public async stop(): Promise<void> {
        const server = this.server;
        if (server === null) {
            return;
        }
        this.server = null;

        await new Promise<void>((resolve) => {
            server.close(() => resolve());
            server.closeAllConnections();
        });
        this.logger.info('mobile web server stopped');
    }

    /**
     * 判断服务当前是否正在监听。
     *
     * @returns 已启动时为 true。
     */
    public isRunning(): boolean {
        return this.server !== null;
    }

    /**
     * 处理单个 HTTP 请求。
     *
     * @param request HTTP 请求。
     * @param response HTTP 响应。
     */
    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        response.setHeader('X-Content-Type-Options', 'nosniff');

        try {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(url.pathname);

            if (pathname === '/favicon.ico') {
                response.writeHead(204);
                response.end();
                return;
            }

            if (pathname === '/api/recent') {
                if (request.method !== 'GET') {
                    this.sendJson(response, 405, { error: '只支持 GET' });
                    return;
                }
                const items = await this.source.listRecent();
                this.sendJson(response, 200, { items });
                return;
            }

            if (pathname === '/api/dictionary') {
                if (request.method !== 'GET') {
                    this.sendJson(response, 405, { error: '只支持 GET' });
                    return;
                }
                const word = (url.searchParams.get('word') ?? '').trim();
                if (word === '' || word.length > 64) {
                    this.sendJson(response, 400, { error: '缺少合法的查询单词' });
                    return;
                }
                const result = await this.source.lookupWord(word);
                this.sendJson(response, 200, { result });
                return;
            }

            if (pathname === '/api/translate') {
                if (request.method !== 'POST') {
                    this.sendJson(response, 405, { error: '只支持 POST' });
                    return;
                }
                const body = await readJsonBody(request);
                if (!Array.isArray(body.texts) || body.texts.length === 0 || body.texts.length > 50) {
                    this.sendJson(response, 400, { error: '一次最多翻译 50 行' });
                    return;
                }
                if (!body.texts.every((text) => typeof text === 'string')) {
                    this.sendJson(response, 400, { error: '待翻译内容必须是字符串' });
                    return;
                }
                const texts = body.texts as string[];
                const totalLength = texts.reduce((sum, text) => sum + text.length, 0);
                if (totalLength > 10_000) {
                    this.sendJson(response, 400, { error: '待翻译内容过长' });
                    return;
                }
                const translations = await this.source.translateTexts(texts);
                this.sendJson(response, 200, { translations });
                return;
            }

            const videoMatch = /^\/api\/videos\/([^/]+)(\/stream|\/progress|\/thumb)?$/.exec(pathname);
            if (videoMatch !== null) {
                const id = videoMatch[1];
                const action = videoMatch[2];
                if (action === '/stream') {
                    if (request.method !== 'GET' && request.method !== 'HEAD') {
                        this.sendJson(response, 405, { error: '只支持 GET' });
                        return;
                    }
                    await this.serveVideo(request, response, id);
                    return;
                }
                if (action === '/thumb') {
                    if (request.method !== 'GET' && request.method !== 'HEAD') {
                        this.sendJson(response, 405, { error: '只支持 GET' });
                        return;
                    }
                    await this.serveThumbnail(request, response, id);
                    return;
                }
                if (action === '/progress') {
                    if (request.method !== 'POST') {
                        this.sendJson(response, 405, { error: '只支持 POST' });
                        return;
                    }
                    const body = await readJsonBody(request);
                    const position = Number(body.position);
                    if (!Number.isFinite(position) || position < 0) {
                        this.sendJson(response, 400, { error: '播放位置无效' });
                        return;
                    }
                    await this.source.saveProgress(id, position);
                    this.sendJson(response, 200, { ok: true });
                    return;
                }
                if (request.method !== 'GET') {
                    this.sendJson(response, 405, { error: '只支持 GET' });
                    return;
                }
                const video = await this.source.getWatchDetail(id);
                this.sendJson(response, 200, video);
                return;
            }

            if (request.method === 'GET' || request.method === 'HEAD') {
                await this.serveStatic(response, pathname, request.method === 'HEAD');
                return;
            }

            this.sendJson(response, 404, { error: '页面不存在' });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn('mobile web request failed', {
                method: request.method,
                path: (request.url ?? '').split('?')[0],
                error: message,
            });
            if (!response.headersSent && !response.destroyed) {
                try {
                    this.sendJson(response, 500, { error: message });
                    return;
                } catch {
                    // 连接已断时继续走 destroy，避免抛回上层变成未处理异常。
                }
            }
            response.destroy();
        }
    }

    /**
     * 返回 React 构建产物的静态文件。
     *
     * 只允许读取静态目录内部的普通文件，拒绝 `..`、绝对路径和目录穿越；
     * 带哈希的 assets 长期缓存，index.html 每次重新校验。
     *
     * @param response HTTP 响应。
     * @param pathname 请求路径。
     * @param headOnly 是否为 HEAD 请求（只回头不回包体）。
     */
    private async serveStatic(
        response: ServerResponse,
        pathname: string,
        headOnly: boolean,
    ): Promise<void> {
        const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const normalized = path.normalize(relativePath);
        if (normalized === '' || normalized === '.' || normalized.startsWith('..')
            || path.isAbsolute(normalized) || normalized.includes('\0')) {
            this.sendJson(response, 404, { error: '页面不存在' });
            return;
        }

        const root = path.resolve(this.staticDirectory);
        const filePath = path.resolve(root, normalized);
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            this.sendJson(response, 404, { error: '页面不存在' });
            return;
        }

        let stat: Stats;
        try {
            stat = await fs.promises.stat(filePath);
        } catch {
            this.sendJson(response, 404, { error: '页面不存在' });
            return;
        }
        if (!stat.isFile()) {
            this.sendJson(response, 404, { error: '页面不存在' });
            return;
        }

        const content = await fs.promises.readFile(filePath);
        const isIndex = normalized === 'index.html';
        response.writeHead(200, {
            'Content-Type': staticContentType(filePath),
            'Content-Length': content.byteLength,
            'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
        });
        response.end(headOnly ? undefined : content);
    }

    /**
     * 输出最近播放列表的大图。
     *
     * @param request HTTP 请求。
     * @param response HTTP 响应。
     * @param id 观看记录 ID。
     */
    private async serveThumbnail(
        request: IncomingMessage,
        response: ServerResponse,
        id: string,
    ): Promise<void> {
        const filePath = await this.source.getThumbnail(id);
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) {
            this.sendJson(response, 404, { error: '缩略图不存在' });
            return;
        }

        response.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600',
        });
        if (request.method === 'HEAD') {
            response.end();
            return;
        }
        this.pipeFile(response, filePath, undefined, undefined);
    }

    /**
     * 输出视频文件，支持 Range 请求。
     *
     * @param request HTTP 请求。
     * @param response HTTP 响应。
     * @param id 观看记录 ID。
     */
    private async serveVideo(
        request: IncomingMessage,
        response: ServerResponse,
        id: string,
    ): Promise<void> {
        const filePath = await this.source.resolveVideoFile(id);
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) {
            this.sendJson(response, 404, { error: '视频文件不存在' });
            return;
        }

        const size = stat.size;
        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Content-Type', mediaContentType(filePath));
        response.setHeader('Cache-Control', 'no-store');

        const rangeHeader = request.headers.range;
        if (rangeHeader === undefined) {
            response.writeHead(200, { 'Content-Length': size });
            if (request.method === 'HEAD') {
                response.end();
                return;
            }
            this.pipeFile(response, filePath, undefined, undefined);
            return;
        }

        const range = parseRange(rangeHeader, size);
        if (range === null) {
            response.writeHead(416, { 'Content-Range': `bytes */${size}` });
            response.end();
            return;
        }

        response.writeHead(206, {
            'Content-Length': range.end - range.start + 1,
            'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        });
        if (request.method === 'HEAD') {
            response.end();
            return;
        }
        this.pipeFile(response, filePath, range.start, range.end);
    }

    /**
     * 把文件片段写入响应，并在连接提前断开时释放读流。
     *
     * @param response HTTP 响应。
     * @param filePath 视频文件路径。
     * @param start 起始字节；未提供时从头读。
     * @param end 结束字节（含）；未提供时读到文件尾。
     */
    private pipeFile(
        response: ServerResponse,
        filePath: string,
        start: number | undefined,
        end: number | undefined,
    ): void {
        const stream = fs.createReadStream(filePath, { start, end });
        stream.on('error', (error) => {
            this.logger.warn('video stream failed', { error });
            response.destroy(error);
        });
        response.on('close', () => {
            stream.destroy();
        });
        stream.pipe(response);
    }

    /**
     * 输出 JSON 响应。
     *
     * @param response HTTP 响应。
     * @param status HTTP 状态码。
     * @param payload 可序列化对象。
     */
    private sendJson(response: ServerResponse, status: number, payload: unknown): void {
        const body = Buffer.from(JSON.stringify(payload), 'utf8');
        response.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': body.byteLength,
            'Cache-Control': 'no-store',
        });
        response.end(body);
    }
}
