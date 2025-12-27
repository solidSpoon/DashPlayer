import React, { FC, memo } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
export const MemoizedReactMarkdown: FC<Options> = memo(
    ReactMarkdown,
    (prevProps, nextProps) =>
        prevProps.children === nextProps.children &&
        prevProps.className === nextProps.className
);

const Markdown: FC<{ children: string }> = ({ children }) => {
    return (
        <MemoizedReactMarkdown
            className="prose dark:prose-invert"
            remarkPlugins={[remarkGfm, remarkMath]}
        >
            {children}
        </MemoizedReactMarkdown>
    );
};

export default Markdown;
