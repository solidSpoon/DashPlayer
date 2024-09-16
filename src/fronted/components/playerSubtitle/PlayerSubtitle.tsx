import usePlayerController from "@/fronted/hooks/usePlayerController";
import React, {ReactElement} from "react";
import PlayerTranslatableLine from "@/fronted/components/playerSubtitle/PlayerTranslatableLine";
import PlayerNormalLine from "@/fronted/components/playerSubtitle/PlayerNormalLine";
import Util from "@/common/utils/Util";
import StrUtil from '@/common/utils/str-util';

const PlayerSubtitle = () => {
    const sentence = usePlayerController((state) => state.currentSentence);
    const clearAdjust = usePlayerController((state) => state.clearAdjust);
    const ele = (): ReactElement[] => {
        if (sentence === undefined) {
            return [];
        }
        const tempEle: Array<string> = [
            sentence.text,
            sentence.msTranslate,
            sentence.textZH,
        ]
            .filter((item) => StrUtil.isNotBlank(item))
            .map((item) => item ?? '');
        return tempEle.map((item, index) => {
            if (index === 0) {
                return (
                    <PlayerTranslatableLine
                        adjusted={sentence.originalBegin != undefined || sentence.originalEnd != undefined}
                        clearAdjust={clearAdjust}
                        key={`first-${sentence.getKey()}`}
                        sentence={sentence}
                    />
                );
            }
            if (index === 1) {
                return (
                    <PlayerNormalLine
                        key={`second-${sentence.getKey()}`}
                        text={item}
                        order="second"
                    />
                );
            }

            return (
                <PlayerNormalLine
                    key={`third-${sentence.getKey()}`}
                    text={item}
                    order="third"
                />
            );
        });
    };

    const render = () => {
        if (sentence === undefined) {
            return <div className="w-full h-full"/>;
        }
        return (
            <div
                key={`trans-sub:${sentence?.getKey()}`}
                className="flex flex-col w-full text-center text-textColor justify-center items-center gap-2"
            >
                {ele()}
            </div>
        );
    };

    return render();
}

export default PlayerSubtitle;
