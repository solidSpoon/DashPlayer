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

const escapeLinkText = (value: string): string => {
    return value.replace(/[[\]()]/g, (match) => `\\${match}`);
};

const preprocessMarkers = (value: string): string => {
    return value.replace(/\[\[(tts|switch):([\s\S]*?)\]\]/g, (_full, markerType, markerValue) => {
        if (markerType === 'tts') {
            const text = markerValue.trim();
            if (!text) {
                return '';
            }
            const label = escapeLinkText(text);
            const href = `${TTS_LINK_PREFIX}${encodeURIComponent(text)}`;
            return `[${label}](${href})`;
        }
        if (markerType === 'switch') {
            const [encoded, rawLabel] = markerValue.split('|');
            const safeEncoded = (encoded ?? '').trim();
            if (!safeEncoded) {
                return '';
            }
            const label = escapeLinkText((rawLabel ?? '').trim() || '点击切换');
            return `[${label}](${SWITCH_LINK_PREFIX}${safeEncoded})`;
        }
        return _full;
    });
};

const asText = (children: any): string => {
    if (typeof children === 'string') {
        return children;
    }
    if (Array.isArray(children)) {
        return children.map((child) => asText(child)).join('');
    }
    if (children?.props?.children) {
        return asText(children.props.children);
    }
    return '';
};

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
