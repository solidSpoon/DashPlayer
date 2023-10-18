import ProgressBar from '@ramonak/react-progress-bar';
import { Component } from 'react';
import { visible, white } from 'chalk';
import useFile from '../hooks/useFile';

const BorderProgressBar = () => {
    const hasSubTitle = useFile((s) => s.subtitleFile !== undefined);
    const completed = 50;
    return (
        <>
            <div className="w-full h-2 bg-stone-200" />
            <div
                className={`w-full flex flex-col-reverse
                items-end absolute bottom-0 h-10 mt-60 pointer-events-none`}
            >
                <div className="w-full z-50 pointer-events-auto bg-scrollbarTrack">
                    <ProgressBar
                        baseBgColor="rgb(var(--colors-scrollbarTrack))"
                        bgColor="rgb(var(--colors-progressbarComplete))"
                        completed={completed}
                        transitionDuration="0.2s"
                        isLabelVisible={false}
                        height="8px"
                        width="100%"
                        borderRadius={`${hasSubTitle ? '0 8px 8px 0' : '0'}`}
                    />
                </div>
            </div>
        </>
    );
};

export default BorderProgressBar;
