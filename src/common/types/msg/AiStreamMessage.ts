
import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";

class AiStreamMessage implements CustomMessage<AiStreamMessage> {
    public taskId: number;
    constructor(taskId: number) {
        this.taskId = taskId;
    }
    toMsg(): MsgT[] {
        return [];
    }
    msgType: MsgType =  "ai-meaning";

    copy(): AiStreamMessage {
        return new AiStreamMessage(this.taskId);
    }
}

export default AiStreamMessage;
