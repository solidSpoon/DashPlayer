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
    // const getWidth = (): number => {
    //     console.log('call');
    //     return screenWidth;
    // };
    return (
        <Resizable axis="x" initial={screenWidth * 0.3} reverse>
            {({ position: position1, separatorProps: separatorProps1 }) => (
                <div className="flex flex-row-reverse bg-blue-500 h-screen overflow-y-auto">
                    <div className="bg-gray-400 " style={{ width: position1 }}>
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
                                className="flex flex-col-reverse bg-green-600 flex-auto"
                                style={{ width: screenWidth - position1 - 1 }}
                            >
                                <div
                                    className="bg-emerald-200 overflow-y-auto"
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
                                    className="bg-emerald-700 flex-auto min-h-0"
                                    style={{
                                        height: screenHeight - position2 - 1,
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
