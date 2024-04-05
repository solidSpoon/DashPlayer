'use client';

import * as React from 'react';
import { cn } from '@/common/utils/Util';
import {
    Drawer, DrawerClose,
    DrawerContent,
    DrawerDescription, DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from '@/fronted/components/ui/drawer';
import { Button } from '@/fronted/components/ui/button';
import { CodeBlock } from '@/fronted/components/chat/codeblock';
import { BotMessage, UserMessage } from '@/fronted/components/chat/message';

export interface ChatProps {
    open: boolean;
    onClose: () => void;
}

const Chat = ({ open, onClose }: ChatProps) => {
    return (
        <Drawer
            open={open}
            onClose={onClose}
        >
            {/* <DrawerTrigger>Open</DrawerTrigger> */}
            <DrawerContent
                className={cn('focus:outline-none')}
                style={{
                    height: 'calc(100vh - 44px)'
                }}
            >
                <DrawerHeader>
                    <DrawerTitle>Are you absolutely sure?</DrawerTitle>
                    <DrawerDescription>This action cannot be undone.</DrawerDescription>
                </DrawerHeader>
                <div
                    className={cn('w-full h-full bg-black grid grid-cols-3')}
                    style={{
                        gridTemplateColumns: '1fr 2fr 1fr'
                    }}
                >
                    <div
                        className={cn('bg-yellow-400')}
                    />
                    <div
                        className={cn('bg-green-400 w-full flex flex-col')}
                    >
                        <CodeBlock
                            key={Math.random()}
                            language={'javascript'}
                            value={'console.log("Hello, World!")'}
                        />
                        <BotMessage>Hello, World!</BotMessage>
                        <UserMessage>
                            # Hello, World!
                        </UserMessage>
                    </div>
                    <div
                        className={cn('bg-blue-400')}
                    />
                </div>
                <DrawerFooter>
                    {/* <Button */}
                    {/*     onClick={onClose} */}
                    {/* >Submit</Button> */}
                    <DrawerClose
                        onClick={onClose}
                    >
                        <Button
                            // onClick={onClose}
                            variant="outline">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>

    );
};

Chat.defaultProps = {
    orientation: 'horizontal',
    className: ''
};

export default Chat;
