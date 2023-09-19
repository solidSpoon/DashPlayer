import Resizable from 'react-resizable-layout';
import React, { ReactElement, useEffect, useState } from 'react';
import SampleSplitter from './SampleSplitter';

interface ResizeableSkeletonParam {
    player: ReactElement;
    currentSentence: ReactElement;
    subtitle: ReactElement;
}
const ResizeableSkeleton = ({
    player,
    currentSentence,
    subtitle,
}: ResizeableSkeletonParam) => {
    const [screenWidth, setScreenWidth] = useState(document.body.clientWidth);
    const [screenHeight, setScreenHeight] = useState(window.innerHeight);
    useEffect(() => {
        const updateScreenSize = () => {
            console.log('updateScreenSize');
            setScreenWidth(document.body.clientWidth);
            setScreenHeight(window.innerHeight);
        };
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, []);
    return (
        <Resizable axis="x" initial={screenWidth * 0.3} reverse>
            {({ position: position1, separatorProps: separatorProps1 }) => (
                <div className="flex flex-row-reverse h-screen">
                    <div className="" style={{ width: position1 }}>
                        {subtitle}
                    </div>
                    <SampleSplitter
                        isVertical
                        id="spitter-2"
                        {...separatorProps1}
                    />
                    <Resizable
                        axis="y"
                        initial={screenHeight * 0.2}
                        reverse
                        min={9}
                    >
                        {({
                            position: position2,
                            separatorProps: separatorProps2,
                        }) => (
                            <div
                                className="flex flex-col-reverse flex-auto"
                                style={{
                                    width: `calc(100vw - ${position1}px - 1px)`,
                                }}
                            >
                                <div
                                    className="z-50"
                                    style={{ height: position2 }}
                                >
                                    {currentSentence}
                                </div>
                                <SampleSplitter
                                    isVertical={false}
                                    id="spitter-1"
                                    {...separatorProps2}
                                />
                                <div
                                    className="flex-auto min-h-0"
                                    style={{
                                        height: `calc(100vh - ${position2}px - 1px)`,
                                    }}
                                >
                                    {player}
                                </div>
                            </div>
                        )}
                    </Resizable>
                </div>
            )}
        </Resizable>
    );
};
export default ResizeableSkeleton;
