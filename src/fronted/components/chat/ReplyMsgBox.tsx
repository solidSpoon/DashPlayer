'use client';

import { IconOpenAI, IconUser } from '@/fronted/components/chat/icons';
import { spinner } from './spinner';
import { CodeBlock } from '@/fronted/components/chat/codeblock';
import { MemoizedReactMarkdown } from './markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/fronted/lib/utils';
import useDpTask from '@/fronted/hooks/useDpTask';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import { useEffect } from 'react';
import { BotMessage } from '@/fronted/components/chat/message';
import { strBlank } from '@/common/utils/Util';


function ReplyMsgBox({
                         taskId,
                         onMsgFinish,
                         className
                     }: {
    taskId: number,
    onMsgFinish: (task: DpTask) => void,
    className?: string
}) {
    // const text = useStreamableText(content);
    const dpTask = useDpTask(taskId, 100);

    useEffect(() => {
        if (dpTask?.status === DpTaskState.DONE) {
            onMsgFinish(dpTask);
        }
    }, [dpTask?.status]);

    let msg = dpTask?.result;
    if (strBlank(msg)) {
        msg = dpTask?.progress;
    }
    return (
        <BotMessage>
            {msg}
        </BotMessage>
    );
}

export default ReplyMsgBox;
