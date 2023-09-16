import { useEffect, useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';
import TransFiller from '../lib/TransFiller';

export interface TitleBarProps {
    title: string | undefined;
    show: boolean;
}

const TitleBarMac = ({ title, show }: TitleBarProps) => {
    const [isMouseOver, setIsMouseOver] = useState(false);
    const showTitleBar = show || isMouseOver;
    useEffect(() => {
        const updateTitleState = async () => {
            if (showTitleBar) {
                // await TransFiller.sleep(200);
                await callApi('show-button', []);
            } else {
                // await TransFiller.sleep(5000);
                await callApi('hide-button', []);
            }
        };
        updateTitleState();
    }, [showTitleBar]);
    const onDoubleClick = async () => {
        const isMaximized = (await callApi('is-maximized', [])) as boolean;
        if (isMaximized) {
            await callApi('unmaximize', []);
        } else {
            await callApi('maximize', []);
        }
    };

    return (
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        <div
            onMouseOver={() => {
                console.log('mmmm over');
                setIsMouseOver(true);
            }}
            onMouseLeave={() => setIsMouseOver(false)}
        >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
                className={`drag w-full h-10 absolute top-0 z-50 hover:bg-amber-300 content-center flex flex-col justify-center items-center select-none ${
                    showTitleBar ? 'bg-amber-300' : ''
                }`}
                onDoubleClick={() => {
                    onDoubleClick();
                }}
            >
                <span className="text-black">{showTitleBar ? title : ''}</span>
            </div>
        </div>
    );
};
export default TitleBarMac;
