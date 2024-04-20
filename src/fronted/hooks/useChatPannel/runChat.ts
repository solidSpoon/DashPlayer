import AiWelcomeMessage from "@/common/types/msg/AiWelcomeMessage";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {strBlank} from "@/common/utils/Util";
import AiStreamMessage from "@/common/types/msg/AiStreamMessage";
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import useChatPanel from "@/fronted/hooks/useChatPanel";
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';

const api = window.electron;

async function taskDetail(taskId: number) {
    return api.call('dp-task/detail', taskId);
}

function responded(task: DpTask) {
    return (task.status === DpTaskState.IN_PROGRESS || task.status === DpTaskState.DONE) && !strBlank(task.result);
}

function taskDone(task: DpTask[]) {
    return task
        .filter(t => t !== undefined && t !== null)
        .every(t => t.status === DpTaskState.DONE);
}

export default class ChatRunner {
    public static runChat = async () => {
        const tm = useChatPanel.getState().tasks.chatTask;
        if (tm === 'done') return;
        if (tm.msgType === 'ai-welcome') {
            const welcomeMessage = tm as AiWelcomeMessage;
            await ChatRunner.aiWelcome(welcomeMessage);
        }
        if (tm.msgType === 'ai-streaming') {
            const welcomeMessage = tm as AiStreamMessage;
            await ChatRunner.aiStreaming(welcomeMessage);
        }
        if (tm.msgType === 'ai-func-explain-select') {
            console.log('ctxMenuExplain runChat');
            const welcomeMessage = tm as AiCtxMenuExplainSelectMessage;
            await ChatRunner.aiFuncExplainSelect(welcomeMessage);
        }
    }

    private static async aiStreaming(welcomeMessage: AiStreamMessage) {
        const synonymousSentence = await taskDetail(welcomeMessage.taskId);
        if (responded(synonymousSentence)) {
            useChatPanel.setState({
                streamingMessage: new AiNormalMessage(synonymousSentence.result)
            });
        }
        if (taskDone([synonymousSentence])) {
            const state = useChatPanel.getState();
            state.setTask({
                ...useChatPanel.getState().tasks,
                chatTask: 'done'
            });
            useChatPanel.setState({
                messages: [
                    ...state.messages,
                    state.streamingMessage.copy()
                ],
                streamingMessage: null
            });
        }
    }


    private static async aiWelcome(welcomeMessage: AiWelcomeMessage) {
        const synonymousSentence = await taskDetail(welcomeMessage.synonymousSentenceTask);
        if (responded(synonymousSentence)) {
            welcomeMessage.synonymousSentenceTaskResp = JSON.parse(synonymousSentence.result);
            if (useChatPanel.getState().topic === welcomeMessage.topic) {
                useChatPanel.setState({
                    streamingMessage: welcomeMessage.copy()
                });
            }
        }
        let punctuation = null;
        if (welcomeMessage.punctuationTask) {
            punctuation = await taskDetail(welcomeMessage.punctuationTask);
            if (responded(punctuation)) {
                welcomeMessage.punctuationTaskResp = JSON.parse(punctuation.result);
                welcomeMessage.punctuationFinish = punctuation.status === DpTaskState.DONE;
                if (useChatPanel.getState().topic === welcomeMessage.topic) {
                    useChatPanel.setState({
                        streamingMessage: welcomeMessage.copy()
                    });
                }
            }
        }
        if (taskDone([synonymousSentence, punctuation])) {
            const state = useChatPanel.getState();
            if (state.topic === welcomeMessage.topic) {
                state.setTask({
                    ...useChatPanel.getState().tasks,
                    chatTask: 'done'
                });
                useChatPanel.setState({
                    messages: [
                        ...state.messages,
                        state.streamingMessage.copy()
                    ],
                    streamingMessage: null
                });
            }
        }
    }

    private static async aiFuncExplainSelect(msg: AiCtxMenuExplainSelectMessage) {
        const synonymousSentence = await taskDetail(msg.taskId);
        if (responded(synonymousSentence)) {
            msg.resp = JSON.parse(synonymousSentence.result);
            if (useChatPanel.getState().topic === msg.topic) {
                useChatPanel.setState({
                    streamingMessage: msg.copy()
                });
            }
        }
        if (taskDone([synonymousSentence])) {
            const state = useChatPanel.getState();
            if (state.topic === msg.topic) {
                state.setTask({
                    ...useChatPanel.getState().tasks,
                    chatTask: 'done'
                });
                useChatPanel.setState({
                    messages: [
                        ...state.messages,
                        state.streamingMessage.copy()
                    ],
                    streamingMessage: null
                });
            }
        }
    }
}
