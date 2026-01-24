import { Button } from '@/fronted/components/ui/button';
import { Trash2 } from 'lucide-react';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import CustomMessage from '@/common/types/msg/interfaces/CustomMessage';

const MessageDeleteButton = ({ msg }: { msg: CustomMessage<any> }) => {
    const deleteMessage = useChatPanel(s => s.deleteMessage).bind(null, msg);
    return (
        <Button variant={'ghost'} size={'icon'} onClick={deleteMessage}
                className={'h-6 w-6 text-muted-foreground hover:text-foreground'}>
            <Trash2
                className={'h-3.5 w-3.5'} />
        </Button>

    );
};

export default MessageDeleteButton;
