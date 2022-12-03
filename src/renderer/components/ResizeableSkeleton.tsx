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
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [screenHeight, setScreenHeight] = useState(window.innerHeight);
    useEffect(() => {
        const updateScreenSize = () => {
            console.log('updateScreenSize');
            setScreenWidth(window.innerWidth);
            setScreenHeight(window.innerHeight);
        };
        window.addEventListener('resize', updateScreenSize);
        return window.removeEventListener('resize', updateScreenSize);
    }, []);
    return (
        <Resizable axis="x" initial={screenWidth * 0.2} reverse>
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
                    <Resizable axis="y" initial={screenHeight * 0.2} reverse>
                        {({
                            position: position2,
                            separatorProps: separatorProps2,
                        }) => (
                            <div className="flex flex-col-reverse bg-green-600 flex-auto">
                                <div
                                    className="bg-emerald-200 overflow-y-auto"
                                    style={{ height: position2 }}
                                >
                                    <div className="w-full overflow-hidden basis-0">1111</div>
                                    {/* {currentSentence} */}
                                </div>
                                <SampleSplitter
                                    isVertical={false}
                                    id="spitter-1"
                                    {...separatorProps2}
                                />
                                <div className="bg-emerald-700 flex-auto">
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
