import React, { FC, memo } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import Playable from '@/fronted/components/shared/common/Playable';
import SwitchTopic from '@/fronted/components/shared/common/SwitchTopic';
export const MemoizedReactMarkdown: FC<Options> = memo(
    ReactMarkdown,
    (prevProps, nextProps) =>
        prevProps.children === nextProps.children &&
        prevProps.className === nextProps.className
);

const TTS_LINK_PREFIX = 'tts:';
const SWITCH_LINK_PREFIX = 'switch:';

/**
 * 转义要回填到 Markdown 文本中的链接标签，避免标签内容破坏原始语法。
 */
const escapeLinkText = (value: string): string => {
    return value.replace(/[[\]()]/g, (match) => `\\${match}`);
};

/**
 * 将自定义协议链接统一规范成可被 Markdown 稳定解析的形式。
 * 这里会兼容 `[文本](switch:原文)` 这类未编码写法，避免空格和标点导致链接失效。
 */
const normalizeCustomProtocolLinks = (value: string): string => {
    return value.replace(/\[([^\][]+)\]\(((?:tts|switch):[\s\S]*?)\)/g, (_full, rawLabel, rawHref) => {
        const separatorIndex = rawHref.indexOf(':');
        if (separatorIndex < 0) {
            return _full;
        }

        const protocol = rawHref.slice(0, separatorIndex + 1);
        const rawTarget = rawHref.slice(separatorIndex + 1).trim();
        if (!rawTarget) {
            return _full;
        }

        const normalizedTarget = encodeURIComponent(safeDecode(rawTarget));
        return `[${rawLabel}](${protocol}${normalizedTarget})`;
    });
};

/**
 * 逐个解析 AI 标记，避免用正则吞掉后续 Markdown 或被标记内容中的特殊字符干扰。
 * 未闭合或空标记会原样保留，便于流式文本在下一次更新时继续解析。
 */
const preprocessMarkers = (value: string): string => {
    const markerStart = /\[\[(tts|switch):/g;
    let result = '';
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = markerStart.exec(value)) !== null) {
        result += value.slice(cursor, match.index);
        const end = value.indexOf(']]', markerStart.lastIndex);
        if (end < 0) {
            result += value.slice(match.index);
            cursor = value.length;
            break;
        }

        const markerType = match[1];
        const markerValue = value.slice(markerStart.lastIndex, end);
        const text = markerValue.trim();
        if (!text) {
            cursor = end + 2;
            markerStart.lastIndex = cursor;
            continue;
        }

        if (markerType === 'tts') {
            const label = escapeLinkText(text);
            result += `[${label}](${TTS_LINK_PREFIX}${encodeURIComponent(text)})`;
        } else {
            const separator = markerValue.indexOf('|');
            const target = (separator < 0 ? markerValue : markerValue.slice(0, separator)).trim();
            const label = (separator < 0 ? '' : markerValue.slice(separator + 1)).trim() || '点击切换';
            if (!target) {
                result += value.slice(match.index, end + 2);
            } else {
                result += `[${escapeLinkText(label)}](${SWITCH_LINK_PREFIX}${encodeURIComponent(target)})`;
            }
        }

        cursor = end + 2;
        markerStart.lastIndex = cursor;
    }

    if (cursor < value.length) {
        result += value.slice(cursor);
    }
    return normalizeCustomProtocolLinks(result);
};

/**
 * 将 ReactMarkdown 传入的子节点递归还原成纯文本，供自定义组件读取标签文案。
 */
const asText = (children: React.ReactNode): string => {
    if (typeof children === 'string') {
        return children;
    }
    if (Array.isArray(children)) {
        return children.map((child) => asText(child)).join('');
    }
    if (React.isValidElement(children) && (children.props as { children?: React.ReactNode }).children) {
        return asText((children.props as { children?: React.ReactNode }).children);
    }
    return '';
};

/**
 * 安全解码自定义链接目标，避免遇到非标准编码时直接抛错。
 */
const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const Markdown: FC<{ children: string }> = ({ children }) => {
    return (
        <MemoizedReactMarkdown
            className="prose dark:prose-invert"
            urlTransform={(uri) => uri}
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
                a: ({ href, children: linkChildren }) => {
                    if (href?.startsWith(TTS_LINK_PREFIX)) {
                        const content = asText(linkChildren) || safeDecode(href.slice(TTS_LINK_PREFIX.length));
                        return <Playable>{content}</Playable>;
                    }
                    if (href?.startsWith(SWITCH_LINK_PREFIX)) {
                        return (
                            <SwitchTopic
                                encoded={href.slice(SWITCH_LINK_PREFIX.length)}
                                label={asText(linkChildren)}
                            />
                        );
                    }
                    return <a href={href}>{linkChildren}</a>;
                },
            }}
        >
            {preprocessMarkers(children)}
        </MemoizedReactMarkdown>
    );
};

export default Markdown;
