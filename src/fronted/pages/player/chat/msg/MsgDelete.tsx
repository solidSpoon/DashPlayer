import { Button } from '@/fronted/components/ui/button';
import { Trash2 } from 'lucide-react';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import CustomMessage from '@/common/types/msg/interfaces/CustomMessage';

const MsgDelete = ({ msg }: { msg: CustomMessage<any> }) => {
    const deleteMessage = useChatPanel(s => s.deleteMessage).bind(null, msg);
    return (
        <Button variant={'ghost'} size={'icon'} onClick={deleteMessage}
                className={'absolute top-0 right-4 h-8 w-8 group text-gray-500 dark:text-gray-200'}>
            <Trash2
                className={'h-4 w-4'} />
        </Button>

    );
};

export default MsgDelete;
