import AiWelcomeMessage from '@/common/types/msg/AiWelcomeMessage';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import { strBlank } from '@/common/utils/Util';
import AiStreamMessage from '@/common/types/msg/AiStreamMessage';
import useChatPanel, { Topic } from '@/fronted/hooks/useChatPanel';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import CustomMessage from '@/common/types/msg/interfaces/CustomMessage';
import HumanNormalMessage from '@/common/types/msg/HumanNormalMessage';
import AiNormalMessage from '@/common/types/msg/AiNormalMessage';
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
        if (tm.msgType === 'ai-func-explain-select-with-context') {
            const welcomeMessage = tm as AiCtxMenuExplainSelectWithContextMessage;
            await ChatRunner.aiFuncExplainSelectWithContext(welcomeMessage);
        }
        if (tm.msgType === 'ai-func-explain-select') {
            const msg = tm as AiCtxMenuExplainSelectMessage;
            await ChatRunner.aiFuncExplainSelect(msg);
        }
        if (tm.msgType === 'ai-func-polish') {
            const welcomeMessage = tm as AiCtxMenuPolishMessage;
            await ChatRunner.aiFuncPolish(welcomeMessage);
        }
        if (tm.msgType === 'human-normal') {
            const msg = tm as HumanNormalMessage;
            await ChatRunner.humanNormal(msg);
        }
    };

    private static async aiStreaming(msg: AiStreamMessage) {
        const synonymousSentence = await taskDetail(msg.taskId);
        console.log('aiStreaming', msg, synonymousSentence);
        if (responded(synonymousSentence)) {
            console.log('aiStreaming resp', synonymousSentence);
            ChatRunner.updateMsg(new AiNormalMessage(msg.getTopic(), synonymousSentence.result));
        }
        ChatRunner.commonTaskDone([synonymousSentence], msg.getTopic());
    }


    private static async aiWelcome(msg: AiWelcomeMessage) {
        const synonymousSentence = await taskDetail(msg.polishTask);
        if (responded(synonymousSentence)) {
            msg.aiFuncPolishTaskRes = JSON.parse(synonymousSentence.result);
            ChatRunner.updateMsg(msg);
        }
        let punctuation = null;
        if (msg.punctuationTask) {
            punctuation = await taskDetail(msg.punctuationTask);
            if (responded(punctuation)) {
                msg.punctuationTaskResp = JSON.parse(punctuation.result);
                ChatRunner.updateMsg(msg);
            }
        }
        ChatRunner.commonTaskDone([synonymousSentence, punctuation], msg.getTopic());
    }

    private static async aiFuncExplainSelectWithContext(msg: AiCtxMenuExplainSelectWithContextMessage) {
        const task = await taskDetail(msg.taskId);
        if (responded(task)) {
            msg.resp = JSON.parse(task.result);
            ChatRunner.updateMsg(msg);
        }
        ChatRunner.commonTaskDone([task], msg.getTopic());
    }
    private static async aiFuncExplainSelect(msg: AiCtxMenuExplainSelectMessage) {
        const task = await taskDetail(msg.taskId);
        if (responded(task)) {
            msg.resp = JSON.parse(task.result);
            ChatRunner.updateMsg(msg);
        }
        ChatRunner.commonTaskDone([task], msg.getTopic());
    }
    private static async aiFuncPolish(msg: AiCtxMenuPolishMessage) {
        const synonymousSentence = await taskDetail(msg.taskId);
        if (responded(synonymousSentence)) {
            msg.resp = JSON.parse(synonymousSentence.result);
            ChatRunner.updateMsg(msg);
        }
        ChatRunner.commonTaskDone([synonymousSentence], msg.getTopic());
    }

    private static async humanNormal(msg: HumanNormalMessage) {
        useChatPanel.setState({
            messages: [
                ...useChatPanel.getState().messages,
                msg.copy()
            ]
        });
        const history = [...useChatPanel.getState().messages, msg]
            .flatMap(e => e.toMsg());
        const taskID = await api.call('ai-func/chat', { msgs: history });
        useChatPanel.setState({
            tasks: {
                ...useChatPanel.getState().tasks,
                chatTask: new AiStreamMessage(msg.getTopic(), taskID)
            }
        });
    }

    private static updateMsg(msg: CustomMessage<any>) {
        if (useChatPanel.getState().topic === msg.getTopic()) {
            useChatPanel.setState({
                streamingMessage: msg.copy()
            });
        }
    }

    private static commonTaskDone(tasks: DpTask[], topic: Topic) {
        if (taskDone(tasks)) {
            const state = useChatPanel.getState();
            if (state.topic === topic) {
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
