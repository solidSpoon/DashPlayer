import {FC, memo} from 'react'
import ReactMarkdown, {Options} from 'react-markdown'
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import React from 'react'
export const MemoizedReactMarkdown: FC<Options> = memo(
    ReactMarkdown,
    (prevProps, nextProps) =>
        prevProps.children === nextProps.children &&
        prevProps.className === nextProps.className
)
const Md: FC<{ children: string }> = ({children}) => {
    return <MemoizedReactMarkdown
        className="prose dark:prose-invert"
        remarkPlugins={[remarkGfm, remarkMath]}
    >
        {children}
    </MemoizedReactMarkdown>
}

export default Md;
