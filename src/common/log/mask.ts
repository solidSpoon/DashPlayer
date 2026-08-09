/**
 * 日志脱敏工具：按字段名与字符串值模式对敏感信息统一掩码。
 * 供 IPC 日志（registerRoute）与主进程/渲染端日志（simple-logger）共用。
 */

/**
 * 敏感字段名：命中即整体掩码。
 * 除常见密钥字段外，单独匹配独立 key 字段（如 openai.key），避免 apiKeys.openAi.key 漏过。
 */
export const SENSITIVE_KEY_RE = /(apiKey|accessKey|secret|token|password|authorization|cookie|\bkey\b)/i;

/** 敏感值模式：字符串中命中即替换为掩码占位。 */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
    /sk-[A-Za-z0-9_-]{16,}/g,
    /Bearer\s+\S+/g,
];

/**
 * 判断字段名是否为敏感字段。
 * @param key 字段名。
 * @returns 命中敏感字段名返回 true。
 */
export function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_RE.test(key);
}

/**
 * 对字符串中的敏感值模式做掩码替换。
 * @param text 原始字符串。
 * @returns 掩码后的字符串；无敏感模式时原样返回。
 */
export function maskSensitiveValues(text: string): string {
    let masked = text;
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
        masked = masked.replace(pattern, (match) => (match.startsWith('sk-') ? 'sk-***' : 'Bearer ***'));
    }
    return masked;
}
