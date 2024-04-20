import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";

class AiMeaningMessage implements CustomMessage<AiMeaningMessage> {
    public context: string | null = null;
    public selected: string;
    public taskId: number | null = null;
    public aiResp: string | null = null;

    constructor(context: string | null = null, selected: string) {
        this.context = context;
        this.selected = selected;
    }

    toMsg(): MsgT[] {
        if (this.aiResp === null) {
            return [];
        }
        return [{
            type: 'human',
            content: this.context ? `在 ${this.context} 中, ${this.selected} 的意思是什么?` : `请问 ${this.selected} 的意思是什么?`
        }, {
            type: 'ai',
            content: this.aiResp
        }];
    }

    msgType: MsgType = "ai-meaning";

    copy(): AiMeaningMessage {
        return new AiMeaningMessage(this.context, this.selected);
    }
}

export default AiMeaningMessage;
