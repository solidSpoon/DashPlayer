
interface MsgT {
    type: 'ai' | 'human' | 'system';
    content: string;
}

export default MsgT;
